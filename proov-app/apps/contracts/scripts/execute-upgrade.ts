import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Execute a previously scheduled UUPS upgrade (step 2 of 2).
 * Run this after the 2-day Timelock delay has passed.
 *
 * Usage:
 *   CONTRACT=ProovCore pnpm timelock:execute --network celo
 */

async function main() {
  const contractName = process.env.CONTRACT;
  if (!contractName) throw new Error('Set CONTRACT=<name> (e.g. CONTRACT=ProovCore)');

  const [executor] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log('Network :', network.name);
  console.log('Executor:', executor.address);

  const deployedPath  = path.join(__dirname, '../deployed-mainnet.json');
  const proposalsPath = path.join(__dirname, '../proposals.json');
  if (!fs.existsSync(proposalsPath)) throw new Error('proposals.json not found — run propose-upgrade first');

  const deployed  = JSON.parse(fs.readFileSync(deployedPath, 'utf8'));
  const proposals = JSON.parse(fs.readFileSync(proposalsPath, 'utf8'));
  const proposal  = proposals[contractName];
  if (!proposal) throw new Error(`No pending proposal for ${contractName}`);

  const timelockAbi = [
    'function execute(address,uint256,bytes,bytes32,bytes32) external payable',
    'function isOperationReady(bytes32) view returns (bool)',
    'function hashOperation(address,uint256,bytes,bytes32,bytes32) view returns (bytes32)',
  ];
  const timelock = new ethers.Contract(deployed.TimelockController, timelockAbi, executor);

  const opId    = await timelock.hashOperation(proposal.proxyAddress, 0, proposal.upgradeData, ethers.ZeroHash, proposal.salt);
  const isReady = await timelock.isOperationReady(opId);

  if (!isReady) {
    const executableAt = new Date(proposal.scheduledAt + proposal.delaySecs * 1000);
    throw new Error(`Not ready yet. Executable after: ${executableAt.toISOString()}`);
  }

  console.log(`\nExecuting upgrade for ${contractName}...`);
  const tx = await timelock.execute(proposal.proxyAddress, 0, proposal.upgradeData, ethers.ZeroHash, proposal.salt);
  await tx.wait();
  console.log('Upgrade executed. tx:', tx.hash);
  console.log(`${contractName} implementation => ${proposal.newImplAddress}`);

  // Remove the executed proposal.
  delete proposals[contractName];
  fs.writeFileSync(proposalsPath, JSON.stringify(proposals, null, 2));
}

main().catch(console.error);
