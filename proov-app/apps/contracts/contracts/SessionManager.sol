// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IProovCore {
    function completeHabit(address user, uint256 habitId, bytes32 verificationHash) external;
}

contract SessionManager is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuard {

    uint256 public constant MIN_SESSION_SECONDS = 1500; // 25 minutes

    struct Session {
        uint256 habitId;
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint256 duration;
        bool completed; // true = full session, false = abandoned/partial
        bool active;
    }

    // CRITICAL: Never remove or reorder these variables in future upgrades.
    mapping(address => Session) public activeSession;
    mapping(address => Session[]) public sessionHistory;

    IProovCore public proovCore;

    uint256[50] private __gap;

    // ── Events ─────────────────────────────────────────────────
    event SessionStarted(address indexed user, uint256 indexed habitId, uint256 startTimestamp);
    event SessionCompleted(address indexed user, uint256 indexed habitId, uint256 duration);
    event SessionEnded(address indexed user, uint256 indexed habitId, uint256 duration, uint256 timestamp);
    event SessionAbandoned(address indexed user, uint256 indexed habitId, uint256 duration);

    // ── UUPS ───────────────────────────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner, address _proovCore) public initializer {
        __Ownable_init(initialOwner);

        
        proovCore = IProovCore(_proovCore);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setProovCore(address _proovCore) external onlyOwner {
        proovCore = IProovCore(_proovCore);
    }

    // ── Session Logic ──────────────────────────────────────────
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
            emit SessionEnded(msg.sender, s.habitId, duration, block.timestamp);
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
