import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Hand the Timelock proposer role to a Safe multisig and remove the deployer EOA.
 * Run this after creating a 2/3 Safe at https://app.safe.global on Celo.
 *
 * Usage:
 *   SAFE_ADDRESS=0x… pnpm timelock:add-safe --network celo
 *
 * What it does:
 *   1. Grants PROPOSER_ROLE  to the Safe.
 *   2. Grants CANCELLER_ROLE to the Safe (so the Safe can cancel malicious proposals).
 *   3. Revokes PROPOSER_ROLE  from the deployer EOA.
 *   4. Revokes CANCELLER_ROLE from the deployer EOA.
 *   5. Renounces TIMELOCK_ADMIN_ROLE from the deployer EOA (irreversible — Safe is now sovereign).
 *
 * After this, no single EOA can propose or cancel upgrades.
 */

async function main() {
  const safeAddress = process.env.SAFE_ADDRESS;
  if (!safeAddress || !ethers.isAddress(safeAddress)) {
    throw new Error('Set SAFE_ADDRESS=0x… to your deployed Safe contract');
  }

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log('Network :', network.name);
  console.log('Deployer:', deployer.address);
  console.log('Safe    :', safeAddress);

  const deployedPath = path.join(__dirname, '../deployed-mainnet.json');
  const deployed     = JSON.parse(fs.readFileSync(deployedPath, 'utf8'));
  if (!deployed.TimelockController) throw new Error('TimelockController not in deployed-mainnet.json');

  const timelockAbi = [
    'function grantRole(bytes32 role, address account) external',
    'function revokeRole(bytes32 role, address account) external',
    'function renounceRole(bytes32 role, address callerConfirmation) external',
    'function PROPOSER_ROLE() view returns (bytes32)',
    'function CANCELLER_ROLE() view returns (bytes32)',
    'function TIMELOCK_ADMIN_ROLE() view returns (bytes32)',
  ];
  const timelock = new ethers.Contract(deployed.TimelockController, timelockAbi, deployer);

  const PROPOSER_ROLE       = await timelock.PROPOSER_ROLE();
  const CANCELLER_ROLE      = await timelock.CANCELLER_ROLE();
  const TIMELOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();

  console.log('\nGranting PROPOSER_ROLE to Safe...');
  await (await timelock.grantRole(PROPOSER_ROLE, safeAddress)).wait();

  console.log('Granting CANCELLER_ROLE to Safe...');
  await (await timelock.grantRole(CANCELLER_ROLE, safeAddress)).wait();

  console.log('Revoking PROPOSER_ROLE from deployer...');
  await (await timelock.revokeRole(PROPOSER_ROLE, deployer.address)).wait();

  console.log('Revoking CANCELLER_ROLE from deployer...');
  await (await timelock.revokeRole(CANCELLER_ROLE, deployer.address)).wait();

  console.log('Renouncing TIMELOCK_ADMIN_ROLE (irreversible)...');
  await (await timelock.renounceRole(TIMELOCK_ADMIN_ROLE, deployer.address)).wait();

  // Persist the Safe address for reference.
  deployed.SafeMultisig = safeAddress;
  fs.writeFileSync(deployedPath, JSON.stringify(deployed, null, 2));

  console.log(`
── Done ──────────────────────────────────────────────────────────────────────
The Safe (${safeAddress}) is now the sole proposer.
The deployer EOA has no remaining roles on the Timelock.
Upgrades now require 2/3 Safe signatures + 2-day delay.
──────────────────────────────────────────────────────────────────────────────
`);
}

main().catch(console.error);
