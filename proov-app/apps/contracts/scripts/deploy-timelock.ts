import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Deploys a TimelockController and transfers ownership of all four Proov
 * proxies to it.  After this runs, upgrades and privileged owner calls
 * require a 2-day queued proposal — no single key can act instantly.
 *
 * Usage:
 *   pnpm timelock:deploy:sepolia
 *   pnpm timelock:deploy:celo
 *
 * Next step (once you have a Safe):
 *   pnpm timelock:add-safe --network celo
 */

const DELAY = 2 * 24 * 60 * 60; // 2 days in seconds

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log('Network :', network.name, `(chainId: ${network.chainId})`);
  console.log('Deployer:', deployer.address);
  console.log('Balance :', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'CELO\n');

  const deployedPath = path.join(__dirname, '../deployed-mainnet.json');
  if (!fs.existsSync(deployedPath)) throw new Error('deployed-mainnet.json not found');
  const deployed = JSON.parse(fs.readFileSync(deployedPath, 'utf8'));

  // ── 1. Deploy TimelockController ─────────────────────────────────────────────
  // proposers : [deployer] — swap for Safe once created (see timelock-add-safe.ts)
  // executors : [address(0)] — anyone may execute an operation after the delay
  // admin     : deployer — revoke this role after Safe is the proposer
  console.log('Deploying TimelockController (2-day delay)...');
  const TimelockFactory = await ethers.getContractFactory('TimelockController');
  const timelock = await TimelockFactory.deploy(
    DELAY,
    [deployer.address],   // proposers
    [ethers.ZeroAddress], // executors — open execution
    deployer.address,     // admin
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log('TimelockController :', timelockAddress, '\n');

  // ── 2. Transfer ownership of every proxy to the Timelock ─────────────────────
  const ownableAbi = ['function transferOwnership(address newOwner) external'];
  const proxies = [
    { name: 'ProovCore',      address: deployed.ProovCore },
    { name: 'SessionManager', address: deployed.SessionManager },
    { name: 'CircleManager',  address: deployed.CircleManager },
    { name: 'FuelFaucet',     address: deployed.FuelFaucet },
  ];

  for (const { name, address } of proxies) {
    if (!address) { console.log(`  Skipping ${name} — no address`); continue; }
    const proxy = new ethers.Contract(address, ownableAbi, deployer);
    const tx = await proxy.transferOwnership(timelockAddress);
    await tx.wait();
    console.log(`  ${name}: owner => Timelock`);
  }

  // ── 3. Persist timelock address ───────────────────────────────────────────────
  deployed.TimelockController = timelockAddress;
  deployed.timelockDelaySecs  = DELAY;
  fs.writeFileSync(deployedPath, JSON.stringify(deployed, null, 2));
  console.log('\nSaved to deployed-mainnet.json');

  console.log(`
── What's next ───────────────────────────────────────────────────────────────
1. Verify on Celoscan:
     npx hardhat verify ${timelockAddress} ${DELAY} '["${deployer.address}"]' '["0x0000000000000000000000000000000000000000"]' "${deployer.address}" --network celo

2. Create a 2/3 Safe at https://app.safe.global on Celo.

3. Hand the proposer role to the Safe and revoke the EOA:
     SAFE_ADDRESS=0x… pnpm timelock:add-safe --network celo

4. To upgrade a contract later:
     CONTRACT=ProovCore pnpm timelock:propose --network celo
     # wait 2 days
     CONTRACT=ProovCore pnpm timelock:execute --network celo
──────────────────────────────────────────────────────────────────────────────
`);
}

main().catch(console.error);
