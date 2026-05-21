// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ProovCore is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuard {

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
    // CRITICAL: Never remove or reorder these variables in future upgrades.
    mapping(address => Habit[]) private _habits;
    mapping(address => UserStats) public stats;
    mapping(address => mapping(uint256 => uint256)) public dailyCompletions; // user → day → count
    mapping(address => mapping(uint256 => bytes32)) public dailyJournalHash; // user → day → hash

    address[] private _allUsers;
    mapping(address => bool) private _isUser;

    address public sessionManager;
    address public circleManager;

    uint256[] public STREAK_MILESTONES;

    // Reserve 50 slots for future storage additions without breaking layout
    uint256[50] private __gap;

    // ── Events ─────────────────────────────────────────────────
    event HabitCreated(address indexed user, uint256 indexed habitId, string name, uint256 timestamp);
    event HabitCompleted(address indexed user, uint256 indexed habitId, uint256 streak, uint256 timestamp);
    event HabitDeactivated(address indexed user, uint256 habitId);
    event HabitEdited(address indexed user, uint256 indexed habitId, string name, uint256 timestamp);
    event StreakUpdated(address indexed user, uint256 newStreak, uint256 longestStreak, uint256 timestamp);
    event StreakBroken(address indexed user, uint256 oldStreak);
    event MilestoneReached(address indexed user, uint256 milestone);
    event JournalLogged(address indexed user, uint256 day, bytes32 contentHash);
    event UsernameSet(address indexed user, string username, uint256 timestamp);
    event VisibilityUpdated(address indexed user, string visibilitySetting, uint256 timestamp);

    // ── Modifiers ──────────────────────────────────────────────
    modifier onlyAuthorized() {
        require(
            msg.sender == sessionManager || msg.sender == circleManager || msg.sender == owner(),
            "ProovCore: not authorized"
        );
        _;
    }

    // ── UUPS ───────────────────────────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);

        
        STREAK_MILESTONES = [7, 21, 30, 50, 100, 200];
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

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
        emit HabitCreated(msg.sender, id, name, block.timestamp);
        return id;
    }

    // Called by SessionManager after a completed timer session
    function completeHabit(
        address user,
        uint256 habitId,
        bytes32 /* verificationHash */
    ) external nonReentrant onlyAuthorized {
        require(habitId < _habits[user].length, "ProovCore: habit not found");
        require(_habits[user][habitId].active, "ProovCore: habit inactive");

        uint256 today = block.timestamp / 86400;
        dailyCompletions[user][today]++;
        _updateStreak(user, today);

        emit HabitCompleted(user, habitId, stats[user].currentStreak, block.timestamp);
    }

    // Called directly by user for fitness/manual habits after AI verification
    function selfCompleteHabit(
        uint256 habitId,
        bytes32 /* verificationHash */
    ) external nonReentrant {
        require(habitId < _habits[msg.sender].length, "ProovCore: habit not found");
        require(_habits[msg.sender][habitId].active, "ProovCore: habit inactive");

        uint256 today = block.timestamp / 86400;
        dailyCompletions[msg.sender][today]++;
        _updateStreak(msg.sender, today);

        emit HabitCompleted(msg.sender, habitId, stats[msg.sender].currentStreak, block.timestamp);
    }

    function deactivateHabit(uint256 habitId) external nonReentrant {
        require(habitId < _habits[msg.sender].length, "ProovCore: habit not found");
        require(_habits[msg.sender][habitId].active, "ProovCore: habit not active");
        _habits[msg.sender][habitId].active = false;
        emit HabitDeactivated(msg.sender, habitId);
    }

    // ── New user-facing overloads (string-based API) ───────────

    function createHabit(
        string calldata name,
        string calldata /* category */,
        bool /* isTimed */,
        uint256 durationSeconds
    ) external nonReentrant returns (uint256) {
        _registerUser(msg.sender);
        uint256 id = _habits[msg.sender].length;
        _habits[msg.sender].push(Habit({
            id: id,
            name: name,
            habitType: HabitType.CUSTOM,
            targetDuration: durationSeconds,
            frequency: Frequency.DAILY,
            createdAt: block.timestamp,
            active: true
        }));
        emit HabitCreated(msg.sender, id, name, block.timestamp);
        return id;
    }

    function completeHabit(uint256 habitId) external nonReentrant {
        require(habitId < _habits[msg.sender].length, "ProovCore: habit not found");
        require(_habits[msg.sender][habitId].active, "ProovCore: habit inactive");
        uint256 today = block.timestamp / 86400;
        dailyCompletions[msg.sender][today]++;
        _updateStreak(msg.sender, today);
        emit HabitCompleted(msg.sender, habitId, stats[msg.sender].currentStreak, block.timestamp);
    }

    function removeHabit(uint256 habitId) external nonReentrant {
        require(habitId < _habits[msg.sender].length, "ProovCore: habit not found");
        require(_habits[msg.sender][habitId].active, "ProovCore: habit not active");
        _habits[msg.sender][habitId].active = false;
        emit HabitDeactivated(msg.sender, habitId);
    }

    function editHabit(
        uint256 habitId,
        string calldata name,
        string calldata /* category */,
        bool /* isTimed */,
        uint256 durationSeconds
    ) external nonReentrant {
        require(habitId < _habits[msg.sender].length, "ProovCore: habit not found");
        require(_habits[msg.sender][habitId].active, "ProovCore: habit inactive");
        _habits[msg.sender][habitId].name = name;
        _habits[msg.sender][habitId].targetDuration = durationSeconds;
        emit HabitEdited(msg.sender, habitId, name, block.timestamp);
    }

    function recordStreakIncrement(uint256 newStreakCount) external {
        _registerUser(msg.sender);
        if (newStreakCount > stats[msg.sender].currentStreak) {
            stats[msg.sender].currentStreak = newStreakCount;
            if (newStreakCount > stats[msg.sender].longestStreak) {
                stats[msg.sender].longestStreak = newStreakCount;
            }
            emit StreakUpdated(msg.sender, newStreakCount, stats[msg.sender].longestStreak, block.timestamp);
        }
    }

    function setUsername(string calldata username) external {
        emit UsernameSet(msg.sender, username, block.timestamp);
    }

    function editUsername(string calldata newUsername) external {
        emit UsernameSet(msg.sender, newUsername, block.timestamp);
    }

    function updateVisibility(string calldata visibilitySetting) external {
        emit VisibilityUpdated(msg.sender, visibilitySetting, block.timestamp);
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
            return;
        } else if (lastDay == today - 1) {
            s.currentStreak++;
        } else if (lastDay == 0) {
            s.currentStreak = 1;
        } else {
            uint256 old = s.currentStreak;
            s.currentStreak = 1;
            emit StreakBroken(user, old);
        }

        s.lastCompletionDay = today;
        s.totalCompletions++;

        if (s.currentStreak > s.longestStreak) {
            s.longestStreak = s.currentStreak;
        }

        emit StreakUpdated(user, s.currentStreak, s.longestStreak, block.timestamp);

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

        address[] memory sorted = new address[](total);
        for (uint256 i = 0; i < total; i++) {
            sorted[i] = _allUsers[i];
        }

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
