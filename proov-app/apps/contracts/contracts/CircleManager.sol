// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CircleManager is ReentrancyGuard, Ownable {

    uint256 public constant MAX_CIRCLE_SIZE = 10;

    mapping(address => address[]) private _circle;
    mapping(address => mapping(address => bool)) public connected;
    mapping(address => address[]) private _pendingRequests;
    mapping(address => mapping(address => bool)) private _hasPending;

    struct Witness {
        address witness;
        uint256 habitId;
        uint256 timestamp;
    }
    mapping(address => Witness[]) public witnesses;

    event RequestSent(address indexed from, address indexed to);
    event RequestAccepted(address indexed from, address indexed to);
    event RequestRejected(address indexed from, address indexed to);
    event RemovedFromCircle(address indexed user, address indexed removed);
    event WitnessAdded(address indexed user, uint256 habitId, address indexed witness);
    event StreakBrokenNotified(address indexed user, address[] circleMembers);

    constructor() Ownable(msg.sender) {}

    function sendRequest(address to) external nonReentrant {
        require(to != msg.sender, "CircleManager: cannot add self");
        require(!connected[msg.sender][to], "CircleManager: already connected");
        require(!_hasPending[to][msg.sender], "CircleManager: request already sent");
        require(_circle[msg.sender].length < MAX_CIRCLE_SIZE, "CircleManager: circle full");

        _pendingRequests[to].push(msg.sender);
        _hasPending[to][msg.sender] = true;
        emit RequestSent(msg.sender, to);
    }

    function acceptRequest(address from) external nonReentrant {
        require(_hasPending[msg.sender][from], "CircleManager: no pending request");
        require(_circle[msg.sender].length < MAX_CIRCLE_SIZE, "CircleManager: circle full");
        require(_circle[from].length < MAX_CIRCLE_SIZE, "CircleManager: their circle full");

        _removePending(msg.sender, from);
        _hasPending[msg.sender][from] = false;

        _circle[msg.sender].push(from);
        _circle[from].push(msg.sender);
        connected[msg.sender][from] = true;
        connected[from][msg.sender] = true;

        emit RequestAccepted(from, msg.sender);
    }

    function rejectRequest(address from) external nonReentrant {
        require(_hasPending[msg.sender][from], "CircleManager: no pending request");
        _removePending(msg.sender, from);
        _hasPending[msg.sender][from] = false;
        emit RequestRejected(from, msg.sender);
    }

    function removeFromCircle(address member) external nonReentrant {
        require(connected[msg.sender][member], "CircleManager: not connected");

        _removeFromArray(_circle[msg.sender], member);
        _removeFromArray(_circle[member], msg.sender);
        connected[msg.sender][member] = false;
        connected[member][msg.sender] = false;

        emit RemovedFromCircle(msg.sender, member);
    }

    function witnessHabit(address user, uint256 habitId) external nonReentrant {
        require(connected[msg.sender][user], "CircleManager: not in circle");
        witnesses[user].push(Witness({
            witness: msg.sender,
            habitId: habitId,
            timestamp: block.timestamp
        }));
        emit WitnessAdded(user, habitId, msg.sender);
    }

    // Called by ProovCore (or frontend after StreakBroken event) to notify circle
    function notifyStreakBroken(address user) external {
        address[] memory circle = _circle[user];
        emit StreakBrokenNotified(user, circle);
    }

    function getCircle(address user) external view returns (address[] memory) {
        return _circle[user];
    }

    function getPending(address user) external view returns (address[] memory) {
        return _pendingRequests[user];
    }

    function getWitnesses(address user) external view returns (Witness[] memory) {
        return witnesses[user];
    }

    function _removeFromArray(address[] storage arr, address target) internal {
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == target) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                break;
            }
        }
    }

    function _removePending(address user, address from) internal {
        address[] storage pending = _pendingRequests[user];
        for (uint256 i = 0; i < pending.length; i++) {
            if (pending[i] == from) {
                pending[i] = pending[pending.length - 1];
                pending.pop();
                break;
            }
        }
    }

    receive() external payable { revert("CircleManager: no ETH accepted"); }
}
