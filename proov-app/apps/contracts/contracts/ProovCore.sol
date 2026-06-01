// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * ProovCore v3 — packed storage, on-chain streak, UUPS upgradeable.
 *
 * Storage layout (one uint256 slot per user, backward-compatible with v2 _habitCount):
 *   bits  0-31  : habitCount       (uint32) — generates deterministic on-chain habit IDs
 *   bits 32-63  : lastCompletionDay (uint32) — unix day number of last habit completion
 *   bits 64-95  : currentStreak    (uint32) — consecutive-day streak
 *   bits 96-127 : longestStreak    (uint32) — all-time longest streak
 *
 * Upgrade safety: v2 stored only the habit counter in bits 0-31; upper bits were 0.
 * The new layout reuses that same slot — existing habit counts are preserved, and the
 * zero upper bits are valid initial state for day/streak/longest fields.
 *
 * Gas vs v2: streak is now computed inside selfCompleteHabit (one SSTORE instead of
 * two separate transactions). Timestamps removed from all events (block.timestamp
 * is always available on the tx; emitting it as calldata wastes ~500 gas per call).
 */
contract ProovCore is Initializable, OwnableUpgradeable, UUPSUpgradeable {

    // ── Custom errors ─────────────────────────────────────────────────────────
    error NotAuthorized();

    // ── Packed user data ──────────────────────────────────────────────────────
    mapping(address => uint256) private _userData;

    // ── Events ────────────────────────────────────────────────────────────────
    event HabitCreated(
        address indexed user,
        uint256 indexed habitId,
        string  name,
        uint8   habitType,
        uint256 targetDuration,
        uint8   frequency
    );
    event HabitCompleted(
        address indexed user,
        uint256 indexed habitId,
        uint256 streak
    );
    event HabitDeactivated(
        address indexed user,
        uint256 indexed habitId
    );
    event HabitReactivated(
        address indexed user,
        uint256 indexed habitId
    );
    event StreakUpdated(
        address indexed user,
        uint256 newStreak,
        uint256 longestStreak
    );
    event StreakBroken(
        address indexed user,
        uint256 oldStreak
    );
    event MilestoneReached(
        address indexed user,
        uint256 milestone
    );
    event UsernameSet(
        address indexed user,
        string  username
    );
    event VisibilityUpdated(
        address indexed user,
        string  visibilitySetting
    );
    event JournalLogged(
        address indexed user,
        bytes32 indexed contentHash
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
        uint256 packed = _userData[msg.sender];
        uint32 count = uint32(packed);
        uint256 habitId = count;
        // Increment count in bits 0-31, preserve streak fields in upper bits.
        _userData[msg.sender] = (packed & ~uint256(type(uint32).max)) | uint256(count + 1);
        emit HabitCreated(msg.sender, habitId, name, habitType, targetDuration, frequency);
        return habitId;
    }

    /**
     * Complete a habit and update the day-streak on-chain.
     * Streak increments once per calendar day (UTC). Completing multiple habits
     * on the same day does not increment the streak twice.
     */
    function selfCompleteHabit(uint256 habitId, bytes32 /* verificationHash */) external {
        uint256 packed = _userData[msg.sender];
        uint32 count   = uint32(packed);
        if (habitId >= count) revert NotAuthorized();

        uint32 lastDay = uint32(packed >> 32);
        uint32 streak  = uint32(packed >> 64);
        uint32 longest = uint32(packed >> 96);

        uint32 today = uint32(block.timestamp / 1 days);

        if (today != lastDay) {
            uint32 oldStreak = streak;

            if (lastDay == 0 || today == lastDay + 1) {
                streak = streak + 1;
            } else {
                // Missed one or more days — streak broken.
                if (oldStreak > 0) emit StreakBroken(msg.sender, oldStreak);
                streak = 1;
            }

            if (streak > longest) longest = streak;

            bool isMilestone = streak == 7  || streak == 21  || streak == 30
                            || streak == 50 || streak == 100 || streak == 200;
            if (isMilestone) emit MilestoneReached(msg.sender, streak);
            emit StreakUpdated(msg.sender, streak, longest);

            _userData[msg.sender] = uint256(count)
                | (uint256(today)   << 32)
                | (uint256(streak)  << 64)
                | (uint256(longest) << 96);
        }

        emit HabitCompleted(msg.sender, habitId, streak);
    }

    function deactivateHabit(uint256 habitId) external {
        emit HabitDeactivated(msg.sender, habitId);
    }

    function reactivateHabit(uint256 habitId) external {
        emit HabitReactivated(msg.sender, habitId);
    }

    // ── Streak / Milestones ────────────────────────────────────────────────────

    /**
     * No-op compat stub. Streak is now tracked inside selfCompleteHabit.
     * Kept so old frontend versions don't revert on the on-chain call.
     */
    function recordStreakIncrement(uint256) external {}

    // ── Profile ────────────────────────────────────────────────────────────────

    function setUsername(string calldata username) external {
        emit UsernameSet(msg.sender, username);
    }

    function updateVisibility(string calldata visibilitySetting) external {
        emit VisibilityUpdated(msg.sender, visibilitySetting);
    }

    // ── Journal ────────────────────────────────────────────────────────────────

    function logJournalEntry(bytes32 contentHash) external {
        emit JournalLogged(msg.sender, contentHash);
    }

    // ── View ───────────────────────────────────────────────────────────────────

    /**
     * Read all packed user fields in one SLOAD.
     */
    function getUserStats(address user) external view returns (
        uint32 habitCount,
        uint32 lastCompletionDay,
        uint32 currentStreak,
        uint32 longestStreak
    ) {
        uint256 packed = _userData[user];
        habitCount        = uint32(packed);
        lastCompletionDay = uint32(packed >> 32);
        currentStreak     = uint32(packed >> 64);
        longestStreak     = uint32(packed >> 96);
    }

    // ── Compat stubs ──────────────────────────────────────────────────────────
    function setSessionManager(address) external onlyOwner {}
    function setCircleManager(address) external onlyOwner {}
}
