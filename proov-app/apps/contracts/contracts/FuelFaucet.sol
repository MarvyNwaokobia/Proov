// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title FuelFaucet
 * @notice Dispenses CELO to Proov users once per 24 hours. UUPS upgradeable.
 *         Owner funds the contract and sets the drip amount.
 */
contract FuelFaucet is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 public dripAmount;
    uint256 public constant CLAIM_INTERVAL = 24 hours;
    uint256 public minContractBalance;

    mapping(address => uint256) public lastClaimTime;

    event FuelClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event FuelDeposited(address indexed from, uint256 amount);
    event DripAmountUpdated(uint256 newAmount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        dripAmount = 0.2 ether;       // 0.2 CELO
        minContractBalance = 1 ether; // pause if below 1 CELO
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ── USER FUNCTIONS ────────────────────────────────────────────────────────

    /**
     * @notice Claim daily fuel. Reverts if claimed within 24h or contract is low.
     */
    function claimFuel() external {
        require(
            address(this).balance >= minContractBalance + dripAmount,
            "Faucet is temporarily empty - check back soon"
        );
        require(
            block.timestamp >= lastClaimTime[msg.sender] + CLAIM_INTERVAL,
            "Already claimed today - come back tomorrow"
        );

        lastClaimTime[msg.sender] = block.timestamp;

        (bool success, ) = payable(msg.sender).call{ value: dripAmount }("");
        require(success, "Transfer failed");

        emit FuelClaimed(msg.sender, dripAmount, block.timestamp);
    }

    /**
     * @notice Check if an address can claim right now.
     */
    function canClaim(address user) external view returns (bool) {
        if (address(this).balance < minContractBalance + dripAmount) return false;
        return block.timestamp >= lastClaimTime[user] + CLAIM_INTERVAL;
    }

    /**
     * @notice Seconds until the address can claim again (0 if claimable now).
     */
    function secondsUntilClaim(address user) external view returns (uint256) {
        uint256 nextClaim = lastClaimTime[user] + CLAIM_INTERVAL;
        if (block.timestamp >= nextClaim) return 0;
        return nextClaim - block.timestamp;
    }

    // ── OWNER FUNCTIONS ───────────────────────────────────────────────────────

    function setDripAmount(uint256 _amount) external onlyOwner {
        require(_amount > 0 && _amount <= 1 ether, "Invalid drip amount");
        dripAmount = _amount;
        emit DripAmountUpdated(_amount);
    }

    function setMinContractBalance(uint256 _min) external onlyOwner {
        minContractBalance = _min;
    }

    function withdrawAll() external onlyOwner {
        (bool success, ) = payable(owner()).call{ value: address(this).balance }("");
        require(success, "Withdraw failed");
    }

    // ── RECEIVE ───────────────────────────────────────────────────────────────

    receive() external payable {
        emit FuelDeposited(msg.sender, msg.value);
    }
}
