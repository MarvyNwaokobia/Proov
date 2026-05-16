import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "CELO");

  // 1. Deploy ProovCore
  console.log("\nDeploying ProovCore...");
  const ProovCore = await ethers.getContractFactory("ProovCore");
  const proovCore = await ProovCore.deploy();
  await proovCore.waitForDeployment();
  const proovCoreAddress = await proovCore.getAddress();
  console.log("ProovCore:", proovCoreAddress);

  // 2. Deploy SessionManager (needs ProovCore address)
  console.log("\nDeploying SessionManager...");
  const SessionManager = await ethers.getContractFactory("SessionManager");
  const sessionManager = await SessionManager.deploy(proovCoreAddress);
  await sessionManager.waitForDeployment();
  const sessionManagerAddress = await sessionManager.getAddress();
  console.log("SessionManager:", sessionManagerAddress);

  // 3. Deploy CircleManager
  console.log("\nDeploying CircleManager...");
  const CircleManager = await ethers.getContractFactory("CircleManager");
  const circleManager = await CircleManager.deploy();
  await circleManager.waitForDeployment();
  const circleManagerAddress = await circleManager.getAddress();
  console.log("CircleManager:", circleManagerAddress);

  // 4. Wire SessionManager + CircleManager into ProovCore
  console.log("\nWiring contracts...");
  await (await proovCore.setSessionManager(sessionManagerAddress)).wait();
  await (await proovCore.setCircleManager(circleManagerAddress)).wait();
  console.log("Contracts wired.");

  // 5. Save addresses for frontend and verification
  const network = await ethers.provider.getNetwork();
  const addresses = {
    ProovCore: proovCoreAddress,
    SessionManager: sessionManagerAddress,
    CircleManager: circleManagerAddress,
    network: network.name,
    chainId: network.chainId.toString(),
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "..", "deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("\nSaved to deployed-addresses.json");
  console.log(JSON.stringify(addresses, null, 2));

  console.log("\n✅ Deployment complete!");
  console.log("\nVerify commands:");
  console.log(`npx hardhat verify --network ${network.name} ${proovCoreAddress}`);
  console.log(`npx hardhat verify --network ${network.name} ${sessionManagerAddress} ${proovCoreAddress}`);
  console.log(`npx hardhat verify --network ${network.name} ${circleManagerAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
