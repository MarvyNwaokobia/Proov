// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IProovCore {
    function completeHabit(address user, uint256 habitId, bytes32 verificationHash) external;
}

contract SessionManager is ReentrancyGuard, Ownable {

    uint256 public constant MIN_SESSION_SECONDS = 1500; // 25 minutes

    struct Session {
        uint256 habitId;
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint256 duration;
        bool completed; // true = full session, false = abandoned/partial
        bool active;
    }

    mapping(address => Session) public activeSession;
    mapping(address => Session[]) public sessionHistory;

    IProovCore public proovCore;

    event SessionStarted(address indexed user, uint256 habitId, uint256 startTimestamp);
    event SessionCompleted(address indexed user, uint256 habitId, uint256 duration);
    event SessionAbandoned(address indexed user, uint256 habitId, uint256 duration);

    constructor(address _proovCore) Ownable(msg.sender) {
        proovCore = IProovCore(_proovCore);
    }

    function startSession(uint256 habitId) external nonReentrant {
        require(!activeSession[msg.sender].active, "SessionManager: session already active");

        activeSession[msg.sender] = Session({
            habitId: habitId,
            startTimestamp: block.timestamp,
            endTimestamp: 0,
            duration: 0,
            completed: false,
            active: true
        });

        emit SessionStarted(msg.sender, habitId, block.timestamp);
    }

    function endSession() external nonReentrant {
        Session storage s = activeSession[msg.sender];
        require(s.active, "SessionManager: no active session");

        uint256 duration = block.timestamp - s.startTimestamp;
        s.endTimestamp = block.timestamp;
        s.duration = duration;
        s.active = false;

        if (duration >= MIN_SESSION_SECONDS) {
            s.completed = true;
            proovCore.completeHabit(msg.sender, s.habitId, bytes32(0));
            emit SessionCompleted(msg.sender, s.habitId, duration);
        } else {
            emit SessionAbandoned(msg.sender, s.habitId, duration);
        }

        sessionHistory[msg.sender].push(s);
        delete activeSession[msg.sender];
    }

    function abandonSession() external nonReentrant {
        Session storage s = activeSession[msg.sender];
        require(s.active, "SessionManager: no active session");

        uint256 duration = block.timestamp - s.startTimestamp;
        s.endTimestamp = block.timestamp;
        s.duration = duration;
        s.active = false;
        s.completed = false;

        sessionHistory[msg.sender].push(s);
        delete activeSession[msg.sender];

        emit SessionAbandoned(msg.sender, s.habitId, duration);
    }

    function getActiveSession(address user) external view returns (Session memory) {
        return activeSession[user];
    }

    function getHistory(address user) external view returns (Session[] memory) {
        return sessionHistory[user];
    }

    receive() external payable { revert("SessionManager: no ETH accepted"); }
}
