import { ethers, upgrades } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log('Network: ', network.name, `(chainId: ${network.chainId})`);
  console.log('Deploying with:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'CELO');

  const opts = { kind: 'uups' as const };

  // 1. ProovCore
  console.log('\n1/4  Deploying ProovCore (UUPS)...');
  const ProovCore = await ethers.getContractFactory('ProovCore');
  const proovCore = await upgrades.deployProxy(ProovCore, [deployer.address], {
    ...opts,
    initializer: 'initialize',
  });
  await proovCore.waitForDeployment();
  const proovCoreAddress = await proovCore.getAddress();
  console.log('     ProovCore proxy:', proovCoreAddress);

  // 2. SessionManager
  console.log('\n2/4  Deploying SessionManager (UUPS)...');
  const SessionManager = await ethers.getContractFactory('SessionManager');
  const sessionManager = await upgrades.deployProxy(
    SessionManager,
    [deployer.address, proovCoreAddress],
    { ...opts, initializer: 'initialize' }
  );
  await sessionManager.waitForDeployment();
  const sessionManagerAddress = await sessionManager.getAddress();
  console.log('     SessionManager proxy:', sessionManagerAddress);

  // 3. CircleManager
  console.log('\n3/4  Deploying CircleManager (UUPS)...');
  const CircleManager = await ethers.getContractFactory('CircleManager');
  const circleManager = await upgrades.deployProxy(CircleManager, [deployer.address], {
    ...opts,
    initializer: 'initialize',
  });
  await circleManager.waitForDeployment();
  const circleManagerAddress = await circleManager.getAddress();
  console.log('     CircleManager proxy:', circleManagerAddress);

  // 4. FuelFaucet
  console.log('\n4/4  Deploying FuelFaucet (UUPS)...');
  const FuelFaucet = await ethers.getContractFactory('FuelFaucet');
  const fuelFaucet = await upgrades.deployProxy(FuelFaucet, [deployer.address], {
    ...opts,
    initializer: 'initialize',
  });
  await fuelFaucet.waitForDeployment();
  const fuelFaucetAddress = await fuelFaucet.getAddress();
  console.log('     FuelFaucet proxy:', fuelFaucetAddress);

  // 5. Wire up cross-contract references
  console.log('\nWiring contracts...');
  await (proovCore as any).setSessionManager(sessionManagerAddress);
  console.log('     ProovCore.sessionManager =>', sessionManagerAddress);
  await (proovCore as any).setCircleManager(circleManagerAddress);
  console.log('     ProovCore.circleManager  =>', circleManagerAddress);

  // 6. Save addresses
  const deployed = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    upgradePattern: 'UUPS',
    ProovCore: proovCoreAddress,
    SessionManager: sessionManagerAddress,
    CircleManager: circleManagerAddress,
    FuelFaucet: fuelFaucetAddress,
  };

  const outputPath = path.join(__dirname, '../deployed-mainnet.json');
  fs.writeFileSync(outputPath, JSON.stringify(deployed, null, 2));
  console.log('\nSaved to deployed-mainnet.json');

  console.log('\n── Update these in Vercel env vars ──────────────────────────');
  console.log(`NEXT_PUBLIC_PROOV_CORE_ADDRESS=${proovCoreAddress}`);
  console.log(`NEXT_PUBLIC_SESSION_MANAGER_ADDRESS=${sessionManagerAddress}`);
  console.log(`NEXT_PUBLIC_CIRCLE_MANAGER_ADDRESS=${circleManagerAddress}`);
  console.log(`NEXT_PUBLIC_FUEL_FAUCET_ADDRESS=${fuelFaucetAddress}`);
  console.log('─────────────────────────────────────────────────────────────');
  console.log('\nFund FuelFaucet proxy to enable fuel claims:');
  console.log(`  cast send ${fuelFaucetAddress} --value 10ether --private-key $PRIVATE_KEY --rpc-url https://forno.celo.org`);
}

main().catch(console.error);
