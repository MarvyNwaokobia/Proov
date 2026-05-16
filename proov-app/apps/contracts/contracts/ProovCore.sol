// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ProovCore is ReentrancyGuard, Ownable {

    // ── Enums ──────────────────────────────────────────────────
    enum HabitType { FOCUS, FITNESS, READING, HYDRATION, SLEEP, CUSTOM }
    enum Frequency { DAILY, WEEKLY }

    // ── Structs ────────────────────────────────────────────────
    struct Habit {
        uint256 id;
        string name;
        HabitType habitType;
        uint256 targetDuration; // seconds (0 = no timer required)
        Frequency frequency;
        uint256 createdAt;
        bool active;
    }

    struct UserStats {
        uint256 currentStreak;
        uint256 longestStreak;
        uint256 totalCompletions;
        uint256 lastCompletionDay; // block.timestamp / 86400
        uint256 journalCount;
    }

    // ── State ──────────────────────────────────────────────────
    mapping(address => Habit[]) private _habits;
    mapping(address => UserStats) public stats;
    mapping(address => mapping(uint256 => uint256)) public dailyCompletions; // user → day → count
    mapping(address => mapping(uint256 => bytes32)) public dailyJournalHash; // user → day → hash

    address[] private _allUsers;
    mapping(address => bool) private _isUser;

    address public sessionManager;
    address public circleManager;

    uint256[] public STREAK_MILESTONES;

    // ── Events ─────────────────────────────────────────────────
    event HabitCreated(address indexed user, uint256 habitId, string name, HabitType habitType);
    event HabitCompleted(address indexed user, uint256 habitId, uint256 day);
    event HabitDeactivated(address indexed user, uint256 habitId);
    event StreakUpdated(address indexed user, uint256 newStreak);
    event StreakBroken(address indexed user, uint256 oldStreak);
    event MilestoneReached(address indexed user, uint256 milestone);
    event JournalLogged(address indexed user, uint256 day, bytes32 contentHash);

    // ── Modifiers ──────────────────────────────────────────────
    modifier onlyAuthorized() {
        require(
            msg.sender == sessionManager || msg.sender == circleManager || msg.sender == owner(),
            "ProovCore: not authorized"
        );
        _;
    }

    constructor() Ownable(msg.sender) {
        STREAK_MILESTONES = [7, 21, 30, 50, 100, 200];
    }

    // ── Setup ──────────────────────────────────────────────────
    function setSessionManager(address _sm) external onlyOwner { sessionManager = _sm; }
    function setCircleManager(address _cm) external onlyOwner { circleManager = _cm; }

    // ── Habit Management ───────────────────────────────────────
    function createHabit(
        string calldata name,
        HabitType habitType,
        uint256 targetDuration,
        Frequency frequency
    ) external nonReentrant returns (uint256) {
        _registerUser(msg.sender);
        uint256 id = _habits[msg.sender].length;
        _habits[msg.sender].push(Habit({
            id: id,
            name: name,
            habitType: habitType,
            targetDuration: targetDuration,
            frequency: frequency,
            createdAt: block.timestamp,
            active: true
        }));
        emit HabitCreated(msg.sender, id, name, habitType);
        return id;
    }

    // Called by SessionManager after a completed timer session
    function completeHabit(
        address user,
        uint256 habitId,
        bytes32 verificationHash
    ) external nonReentrant onlyAuthorized {
        require(habitId < _habits[user].length, "ProovCore: habit not found");
        require(_habits[user][habitId].active, "ProovCore: habit inactive");

        uint256 today = block.timestamp / 86400;
        dailyCompletions[user][today]++;
        _updateStreak(user, today);

        emit HabitCompleted(user, habitId, today);
    }

    // Called directly by user for fitness/manual habits after AI verification
    function selfCompleteHabit(
        uint256 habitId,
        bytes32 verificationHash // hash of AI verification response
    ) external nonReentrant {
        require(habitId < _habits[msg.sender].length, "ProovCore: habit not found");
        require(_habits[msg.sender][habitId].active, "ProovCore: habit inactive");

        uint256 today = block.timestamp / 86400;
        dailyCompletions[msg.sender][today]++;
        _updateStreak(msg.sender, today);

        emit HabitCompleted(msg.sender, habitId, today);
    }

    function deactivateHabit(uint256 habitId) external nonReentrant {
        require(habitId < _habits[msg.sender].length, "ProovCore: habit not found");
        require(_habits[msg.sender][habitId].active, "ProovCore: habit not active");
        _habits[msg.sender][habitId].active = false;
        emit HabitDeactivated(msg.sender, habitId);
    }

    // ── Journal ────────────────────────────────────────────────
    function logJournalEntry(bytes32 contentHash) external nonReentrant {
        _registerUser(msg.sender);
        uint256 today = block.timestamp / 86400;

        // Journal counts as daily activity — keeps streak alive
        if (dailyCompletions[msg.sender][today] == 0) {
            _updateStreak(msg.sender, today);
        }

        dailyJournalHash[msg.sender][today] = contentHash;
        stats[msg.sender].journalCount++;
        emit JournalLogged(msg.sender, today, contentHash);
    }

    // ── Streak Logic ───────────────────────────────────────────
    function _updateStreak(address user, uint256 today) internal {
        UserStats storage s = stats[user];
        uint256 lastDay = s.lastCompletionDay;

        if (lastDay == today) {
            // Already active today — no streak change
            return;
        } else if (lastDay == today - 1) {
            // Consecutive day — streak grows
            s.currentStreak++;
        } else if (lastDay == 0) {
            // First ever completion
            s.currentStreak = 1;
        } else {
            // Gap — streak broken
            uint256 old = s.currentStreak;
            s.currentStreak = 1;
            emit StreakBroken(user, old);
        }

        s.lastCompletionDay = today;
        s.totalCompletions++;

        if (s.currentStreak > s.longestStreak) {
            s.longestStreak = s.currentStreak;
        }

        emit StreakUpdated(user, s.currentStreak);

        for (uint256 i = 0; i < STREAK_MILESTONES.length; i++) {
            if (s.currentStreak == STREAK_MILESTONES[i]) {
                emit MilestoneReached(user, STREAK_MILESTONES[i]);
                break;
            }
        }
    }

    // ── Views ──────────────────────────────────────────────────
    function getHabits(address user) external view returns (Habit[] memory) {
        return _habits[user];
    }

    function getStats(address user) external view returns (UserStats memory) {
        return stats[user];
    }

    function getUserCount() external view returns (uint256) {
        return _allUsers.length;
    }

    function getLeaderboard(uint256 limit) external view returns (address[] memory, uint256[] memory) {
        uint256 total = _allUsers.length;
        uint256 count = total < limit ? total : limit;

        // Copy into memory for sorting
        address[] memory sorted = new address[](total);
        for (uint256 i = 0; i < total; i++) {
            sorted[i] = _allUsers[i];
        }

        // Insertion sort descending by currentStreak
        for (uint256 i = 0; i < total; i++) {
            for (uint256 j = i + 1; j < total; j++) {
                if (stats[sorted[j]].currentStreak > stats[sorted[i]].currentStreak) {
                    address tmp = sorted[i];
                    sorted[i] = sorted[j];
                    sorted[j] = tmp;
                }
            }
        }

        address[] memory addrs = new address[](count);
        uint256[] memory streaks = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            addrs[i] = sorted[i];
            streaks[i] = stats[sorted[i]].currentStreak;
        }
        return (addrs, streaks);
    }

    function _registerUser(address user) internal {
        if (!_isUser[user]) {
            _isUser[user] = true;
            _allUsers.push(user);
        }
    }

    receive() external payable { revert("ProovCore: no ETH accepted"); }
}
