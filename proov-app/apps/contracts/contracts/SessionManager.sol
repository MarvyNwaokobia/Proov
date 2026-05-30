// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * SessionManager v2 — event-log only.
 *
 * Timer sessions are stored in Supabase. This contract records the proof:
 * start, complete, and abandon events with habitId and duration so Dune
 * and Goldsky have real data to index.
 */
contract SessionManager {
    event SessionStarted(
        address indexed user,
        uint256 indexed habitId,
        uint256 startTimestamp
    );
    event SessionCompleted(
        address indexed user,
        uint256 indexed habitId,
        uint256 duration
    );
    event SessionAbandoned(
        address indexed user,
        uint256 indexed habitId,
        uint256 duration
    );

    function startSession(uint256 habitId) external {
        emit SessionStarted(msg.sender, habitId, block.timestamp);
    }

    // Frontend passes habitId and elapsed seconds so Dune gets real data.
    function endSession(uint256 habitId, uint256 durationSeconds) external {
        emit SessionCompleted(msg.sender, habitId, durationSeconds);
    }

    function abandonSession(uint256 habitId, uint256 durationSeconds) external {
        emit SessionAbandoned(msg.sender, habitId, durationSeconds);
    }

    // Compat stub
    function recordProgress(uint256) external {}
}
