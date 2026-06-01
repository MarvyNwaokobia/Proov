// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Compile TimelockController so it is available via ethers.getContractFactory
// in scripts and tests. No custom logic — governance is the stock OZ contract.
import "@openzeppelin/contracts/governance/TimelockController.sol";
