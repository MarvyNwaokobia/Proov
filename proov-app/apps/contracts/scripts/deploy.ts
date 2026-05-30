import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("\n🚀 PROOV — Mainnet Deployment");
  console.log("================================");
  console.log(`Network:  ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance:  ${ethers.formatEther(balance)} CELO\n`);

  if (network.chainId !== 42220n) {
    throw new Error(`Wrong network. Expected 42220 (Celo Mainnet), got ${network.chainId}. Use --network celo`);
  }

  // 1. ProovCore
  console.log("1/3  Deploying ProovCore...");
  const ProovCore = await ethers.getContractFactory("ProovCore");
  const proovCore = await ProovCore.deploy();
  await proovCore.waitForDeployment();
  const proovCoreAddr = await proovCore.getAddress();
  console.log(`     ✅ ProovCore: ${proovCoreAddr}`);

  // 2. SessionManager
  console.log("2/3  Deploying SessionManager...");
  const SessionManager = await ethers.getContractFactory("SessionManager");
  const sessionManager = await SessionManager.deploy();
  await sessionManager.waitForDeployment();
  const sessionManagerAddr = await sessionManager.getAddress();
  console.log(`     ✅ SessionManager: ${sessionManagerAddr}`);

  // 3. CircleManager
  console.log("3/3  Deploying CircleManager...");
  const CircleManager = await ethers.getContractFactory("CircleManager");
  const circleManager = await CircleManager.deploy();
  await circleManager.waitForDeployment();
  const circleManagerAddr = await circleManager.getAddress();
  console.log(`     ✅ CircleManager: ${circleManagerAddr}`);

  // 4. Wire
  console.log("\nWiring contracts...");
  const tx1 = await proovCore.setSessionManager(sessionManagerAddr);
  await tx1.wait();
  console.log("     SessionManager → ProovCore ✓");
  const tx2 = await proovCore.setCircleManager(circleManagerAddr);
  await tx2.wait();
  console.log("     CircleManager  → ProovCore ✓");

  // 5. Save
  const out = {
    network: "celo-mainnet",
    chainId: 42220,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    ProovCore: proovCoreAddr,
    SessionManager: sessionManagerAddr,
    CircleManager: circleManagerAddr,
  };
  fs.writeFileSync(
    path.join(__dirname, "../deployed-mainnet.json"),
    JSON.stringify(out, null, 2)
  );

  console.log("\n📋 Copy these into apps/web/.env.local:");
  console.log(`NEXT_PUBLIC_PROOV_CORE_ADDRESS=${proovCoreAddr}`);
  console.log(`NEXT_PUBLIC_SESSION_MANAGER_ADDRESS=${sessionManagerAddr}`);
  console.log(`NEXT_PUBLIC_CIRCLE_MANAGER_ADDRESS=${circleManagerAddr}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=42220`);
  console.log(`NEXT_PUBLIC_EXPLORER_URL=https://celoscan.io`);

  console.log("\n🔗 Celoscan links:");
  console.log(`ProovCore:      https://celoscan.io/address/${proovCoreAddr}`);
  console.log(`SessionManager: https://celoscan.io/address/${sessionManagerAddr}`);
  console.log(`CircleManager:  https://celoscan.io/address/${circleManagerAddr}`);

  console.log("\n🎉 Deployment complete!");
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
