// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * ProovCore v2 — event-log only, UUPS upgradeable.
 *
 * All habit data lives in Supabase (fast, queryable). This contract is the
 * immutable proof layer: every user action emits an on-chain event that Dune
 * and Goldsky can index. No heavy storage writes means ~25-45k gas per tx
 * vs ~200-300k gas in v1.
 *
 * Only _habitCount is stored — one uint256 per user — to generate
 * deterministic on-chain habit IDs without off-chain coordination.
 */
contract ProovCore is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    mapping(address => uint256) private _habitCount;

    event HabitCreated(
        address indexed user,
        uint256 indexed habitId,
        string  name,
        uint8   habitType,
        uint256 targetDuration,
        uint8   frequency,
        uint256 timestamp
    );
    event HabitCompleted(
        address indexed user,
        uint256 indexed habitId,
        uint256 streak,
        uint256 timestamp
    );
    event HabitDeactivated(
        address indexed user,
        uint256 indexed habitId,
        uint256 timestamp
    );
    event HabitReactivated(
        address indexed user,
        uint256 indexed habitId,
        uint256 timestamp
    );
    event StreakUpdated(
        address indexed user,
        uint256 newStreak,
        uint256 longestStreak,
        uint256 timestamp
    );
    event StreakBroken(
        address indexed user,
        uint256 oldStreak,
        uint256 timestamp
    );
    event MilestoneReached(
        address indexed user,
        uint256 milestone,
        uint256 timestamp
    );
    event UsernameSet(
        address indexed user,
        string  username,
        uint256 timestamp
    );
    event VisibilityUpdated(
        address indexed user,
        string  visibilitySetting,
        uint256 timestamp
    );
    event JournalLogged(
        address indexed user,
        bytes32 indexed contentHash,
        uint256 timestamp
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ── Habit ──────────────────────────────────────────────────────────────────

    function createHabit(
        string calldata name,
        uint8   habitType,
        uint256 targetDuration,
        uint8   frequency
    ) external returns (uint256) {
        uint256 habitId = _habitCount[msg.sender]++;
        emit HabitCreated(msg.sender, habitId, name, habitType, targetDuration, frequency, block.timestamp);
        return habitId;
    }

    function selfCompleteHabit(uint256 habitId, bytes32) external {
        emit HabitCompleted(msg.sender, habitId, 0, block.timestamp);
    }

    function deactivateHabit(uint256 habitId) external {
        emit HabitDeactivated(msg.sender, habitId, block.timestamp);
    }

    function reactivateHabit(uint256 habitId) external {
        emit HabitReactivated(msg.sender, habitId, block.timestamp);
    }

    // ── Streak / Milestones ────────────────────────────────────────────────────

    function recordStreakIncrement(uint256 newStreak) external {
        bool isMilestone = newStreak == 7  || newStreak == 21  || newStreak == 30
                        || newStreak == 50 || newStreak == 100 || newStreak == 200;
        if (isMilestone) emit MilestoneReached(msg.sender, newStreak, block.timestamp);
        emit StreakUpdated(msg.sender, newStreak, newStreak, block.timestamp);
    }

    // ── Profile ────────────────────────────────────────────────────────────────

    function setUsername(string calldata username) external {
        emit UsernameSet(msg.sender, username, block.timestamp);
    }

    function editUsername(string calldata newUsername) external {
        emit UsernameSet(msg.sender, newUsername, block.timestamp);
    }

    function updateVisibility(string calldata visibilitySetting) external {
        emit VisibilityUpdated(msg.sender, visibilitySetting, block.timestamp);
    }

    // ── Journal ────────────────────────────────────────────────────────────────

    function logJournalEntry(bytes32 contentHash) external {
        emit JournalLogged(msg.sender, contentHash, block.timestamp);
    }

    // ── Compat stubs (no-ops — v1 deploy script called these) ─────────────────
    function setSessionManager(address) external onlyOwner {}
    function setCircleManager(address) external onlyOwner {}
}
