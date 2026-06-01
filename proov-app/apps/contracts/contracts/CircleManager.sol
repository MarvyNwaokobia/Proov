// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * CircleManager v3 — event-log only, UUPS upgradeable.
 *
 * Timestamps removed from all events (~500 gas saved per call).
 * cheer() alias removed — callers use sendCheer() for both cheers and nudges.
 */
contract CircleManager is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    event CircleRequestSent(
        address indexed from,
        address indexed to
    );
    event MemberAdded(
        address indexed circleOwner,
        address indexed member
    );
    event CheerSent(
        address indexed from,
        address indexed to
    );
    event RemovedFromCircle(
        address indexed user,
        address indexed removed
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
        emit CircleRequestSent(msg.sender, to);
    }

    function acceptRequest(address from) external {
        emit MemberAdded(from, msg.sender);
    }

    function sendCheer(address to) external {
        emit CheerSent(msg.sender, to);
    }

    function removeFromCircle(address member) external {
        emit RemovedFromCircle(msg.sender, member);
    }
}
