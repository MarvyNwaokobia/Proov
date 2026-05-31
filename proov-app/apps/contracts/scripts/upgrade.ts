import { ethers, upgrades } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Upgrades all Proov contracts to their current implementation.
 * Reads proxy addresses from deployed-mainnet.json and pushes new logic
 * to each proxy without changing the addresses users see.
 *
 * Usage:
 *   pnpm deploy:upgrade:sepolia   — testnet
 *   pnpm deploy:upgrade:celo      — mainnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log('Network: ', network.name, `(chainId: ${network.chainId})`);
  console.log('Upgrading with:', deployer.address);

  const deployedPath = path.join(__dirname, '../deployed-mainnet.json');
  if (!fs.existsSync(deployedPath)) {
    throw new Error('deployed-mainnet.json not found — run deploy:celo first');
  }
  const deployed = JSON.parse(fs.readFileSync(deployedPath, 'utf8'));

  async function upgradeContract(name: string, proxyAddress: string) {
    if (!proxyAddress) {
      console.log(`  Skipping ${name} — no address in deployed-mainnet.json`);
      return;
    }
    console.log(`\nUpgrading ${name} at ${proxyAddress}...`);
    const Factory = await ethers.getContractFactory(name);
    const upgraded = await upgrades.upgradeProxy(proxyAddress, Factory);
    await upgraded.waitForDeployment();
    const impl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log(`  ${name} impl => ${impl}`);
  }

  await upgradeContract('ProovCore',      deployed.ProovCore);
  await upgradeContract('SessionManager', deployed.SessionManager);
  await upgradeContract('CircleManager',  deployed.CircleManager);
  await upgradeContract('FuelFaucet',     deployed.FuelFaucet);

  console.log('\nAll contracts upgraded. Proxy addresses are unchanged.');
}

main().catch(console.error);
