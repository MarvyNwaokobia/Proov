import { ethers, upgrades } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Upgrading with:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'CELO');

  const deployedPath = path.join(__dirname, '../deployed-mainnet.json');
  const deployed = JSON.parse(fs.readFileSync(deployedPath, 'utf8'));

  console.log('\nUpgrading CircleManager at', deployed.CircleManager, '...');
  const Factory = await ethers.getContractFactory('CircleManager');
  const upgraded = await upgrades.upgradeProxy(deployed.CircleManager, Factory);
  await upgraded.waitForDeployment();
  const impl = await upgrades.erc1967.getImplementationAddress(deployed.CircleManager);
  console.log('CircleManager impl =>', impl);
  console.log('\nProxy address unchanged:', deployed.CircleManager);
}

main().catch(console.error);
