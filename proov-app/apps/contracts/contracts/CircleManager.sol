// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * CircleManager v2 — event-log only, UUPS upgradeable.
 *
 * Circle membership and social interactions live in Supabase.
 * Accepting a request and sending cheers/nudges emit on-chain proof.
 */
contract CircleManager is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    event CircleRequestSent(
        address indexed from,
        address indexed to,
        uint256 timestamp
    );
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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function sendRequest(address to) external {
        emit CircleRequestSent(msg.sender, to, block.timestamp);
    }

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
