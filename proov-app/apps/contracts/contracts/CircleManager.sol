// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * CircleManager v2 — event-log only.
 *
 * Circle membership and social interactions live in Supabase.
 * Accepting a request and sending cheers/nudges emit on-chain proof.
 */
contract CircleManager {
    event MemberAdded(
        address indexed circleOwner,
        address indexed member,
        uint256 timestamp
    );
    event CheerSent(
        address indexed from,
        address indexed to,
        uint256 timestamp
    );
    event RemovedFromCircle(
        address indexed user,
        address indexed removed,
        uint256 timestamp
    );

    // Sending a request is a Supabase-only operation (no on-chain proof needed).
    function sendRequest(address) external {}

    // Accepting proves the bond on-chain.
    function acceptRequest(address from) external {
        emit MemberAdded(from, msg.sender, block.timestamp);
    }

    function sendCheer(address to) external {
        emit CheerSent(msg.sender, to, block.timestamp);
    }

    // Alias used in useProovTx
    function cheer(address to) external {
        emit CheerSent(msg.sender, to, block.timestamp);
    }

    function removeFromCircle(address member) external {
        emit RemovedFromCircle(msg.sender, member, block.timestamp);
    }
}
