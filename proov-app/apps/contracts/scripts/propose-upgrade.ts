import { ethers, upgrades } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Schedule a UUPS upgrade through the TimelockController.
 * This is step 1 of 2; run execute-upgrade.ts after the 2-day delay.
 *
 * Usage:
 *   CONTRACT=ProovCore pnpm timelock:propose --network celo
 *
 * What it does:
 *   1. Deploys the new implementation (does NOT touch the proxy yet).
 *   2. Encodes upgradeToAndCall(newImpl, "") for the proxy.
 *   3. Calls timelock.schedule(...) to queue the operation.
 *   4. Saves the proposal to proposals.json for execute-upgrade.ts.
 */

const UPGRADE_ABI = ['function upgradeToAndCall(address newImplementation, bytes calldata data) external payable'];

async function main() {
  const contractName = process.env.CONTRACT;
  if (!contractName) throw new Error('Set CONTRACT=<name> (e.g. CONTRACT=ProovCore)');

  const [proposer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log('Network :', network.name);
  console.log('Proposer:', proposer.address);

  const deployedPath = path.join(__dirname, '../deployed-mainnet.json');
  const deployed     = JSON.parse(fs.readFileSync(deployedPath, 'utf8'));

  const proxyAddress    = deployed[contractName];
  const timelockAddress = deployed.TimelockController;
  if (!proxyAddress)    throw new Error(`${contractName} not in deployed-mainnet.json`);
  if (!timelockAddress) throw new Error('TimelockController not in deployed-mainnet.json — run deploy-timelock first');

  // 1. Deploy new implementation (does not upgrade the proxy).
  console.log(`\nPreparing new ${contractName} implementation...`);
  const Factory = await ethers.getContractFactory(contractName);
  const newImplAddress = await upgrades.prepareUpgrade(proxyAddress, Factory, { kind: 'uups' }) as string;
  console.log('New impl :', newImplAddress);

  // 2. Encode upgradeToAndCall(newImpl, "").
  const iface      = new ethers.Interface(UPGRADE_ABI);
  const upgradeData = iface.encodeFunctionData('upgradeToAndCall', [newImplAddress, '0x']);

  // 3. Unique salt derived from contract name + timestamp.
  const salt  = ethers.id(`${contractName}-upgrade-${Date.now()}`);
  const timelockAbi = [
    'function schedule(address,uint256,bytes,bytes32,bytes32,uint256) external',
    'function getMinDelay() view returns (uint256)',
  ];
  const timelock = new ethers.Contract(timelockAddress, timelockAbi, proposer);
  const delay    = await timelock.getMinDelay();

  console.log(`\nScheduling upgrade (delay: ${Number(delay) / 86400} days)...`);
  const tx = await timelock.schedule(proxyAddress, 0, upgradeData, ethers.ZeroHash, salt, delay);
  await tx.wait();
  console.log('Scheduled. tx:', tx.hash);

  // 4. Save proposal so execute-upgrade.ts can reconstruct the call.
  const proposalsPath = path.join(__dirname, '../proposals.json');
  const proposals: Record<string, unknown> = fs.existsSync(proposalsPath)
    ? JSON.parse(fs.readFileSync(proposalsPath, 'utf8'))
    : {};

  proposals[contractName] = {
    proxyAddress,
    newImplAddress,
    upgradeData,
    salt,
    scheduledAt: Date.now(),
    delaySecs: Number(delay),
  };
  fs.writeFileSync(proposalsPath, JSON.stringify(proposals, null, 2));

  const executableAt = new Date(Date.now() + Number(delay) * 1000);
  console.log(`\nExecutable after: ${executableAt.toISOString()}`);
  console.log(`Run: CONTRACT=${contractName} pnpm timelock:execute --network celo`);
}

main().catch(console.error);
