import { ethers, upgrades } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'CELO');

  // 1. ProovCore
  console.log('\nDeploying ProovCore (UUPS)...');
  const ProovCore = await ethers.getContractFactory('ProovCore');
  const proovCore = await upgrades.deployProxy(ProovCore, [deployer.address], {
    initializer: 'initialize',
    kind: 'uups',
    unsafeAllow: ['constructor'],
  });
  await proovCore.waitForDeployment();
  const proovCoreAddress = await proovCore.getAddress();
  console.log('ProovCore proxy:', proovCoreAddress);

  // 2. SessionManager (needs ProovCore address)
  console.log('\nDeploying SessionManager (UUPS)...');
  const SessionManager = await ethers.getContractFactory('SessionManager');
  const sessionManager = await upgrades.deployProxy(
    SessionManager,
    [deployer.address, proovCoreAddress],
    { initializer: "initialize", kind: "uups", unsafeAllow: ["constructor"] }
  );
  await sessionManager.waitForDeployment();
  const sessionManagerAddress = await sessionManager.getAddress();
  console.log('SessionManager proxy:', sessionManagerAddress);

  // 3. CircleManager
  console.log('\nDeploying CircleManager (UUPS)...');
  const CircleManager = await ethers.getContractFactory('CircleManager');
  const circleManager = await upgrades.deployProxy(CircleManager, [deployer.address], {
    initializer: 'initialize',
    kind: 'uups',
    unsafeAllow: ['constructor'],
  });
  await circleManager.waitForDeployment();
  const circleManagerAddress = await circleManager.getAddress();
  console.log('CircleManager proxy:', circleManagerAddress);

  // 4. Wire up cross-contract references
  console.log('\nWiring contracts...');
  await (proovCore as any).setSessionManager(sessionManagerAddress);
  console.log('ProovCore.sessionManager =>', sessionManagerAddress);
  await (proovCore as any).setCircleManager(circleManagerAddress);
  console.log('ProovCore.circleManager =>', circleManagerAddress);

  // 5. Save addresses
  const deployed = {
    network: 'celo-mainnet',
    chainId: 42220,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    ProovCore: proovCoreAddress,
    SessionManager: sessionManagerAddress,
    CircleManager: circleManagerAddress,
    upgradePattern: 'UUPS',
  };

  const outputPath = path.join(__dirname, '../deployed-mainnet.json');
  fs.writeFileSync(outputPath, JSON.stringify(deployed, null, 2));
  console.log('\nSaved to deployed-mainnet.json');

  console.log('\n── Update these in Vercel env vars ──────────────────────');
  console.log(`NEXT_PUBLIC_PROOV_CORE_ADDRESS=${proovCoreAddress}`);
  console.log(`NEXT_PUBLIC_SESSION_MANAGER_ADDRESS=${sessionManagerAddress}`);
  console.log(`NEXT_PUBLIC_CIRCLE_MANAGER_ADDRESS=${circleManagerAddress}`);
  console.log('─────────────────────────────────────────────────────────');
}

main().catch(console.error);
