import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const SAFE_ADDRESS = '0x1F22b145b092177330354074CC5e9300fe049B5c';

const OWNABLE_ABI = [
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)',
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log('Network :', network.name, `(chainId: ${network.chainId})`);
  console.log('Caller  :', deployer.address);
  console.log('Safe    :', SAFE_ADDRESS);
  console.log('Balance :', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'CELO');
  console.log();

  if (network.chainId !== 42220n) {
    throw new Error('This script must run on Celo mainnet (chainId 42220). Use --network celo.');
  }

  const deployedPath = path.join(__dirname, '../deployed-mainnet.json');
  if (!fs.existsSync(deployedPath)) {
    throw new Error('deployed-mainnet.json not found — run deploy:celo first');
  }
  const deployed = JSON.parse(fs.readFileSync(deployedPath, 'utf8'));

  const contracts: Array<{ name: string; address: string }> = [
    { name: 'ProovCore',      address: deployed.ProovCore },
    { name: 'SessionManager', address: deployed.SessionManager },
    { name: 'CircleManager',  address: deployed.CircleManager },
    { name: 'FuelFaucet',     address: deployed.FuelFaucet },
  ];

  for (const { name, address } of contracts) {
    if (!address) {
      console.log(`  SKIP  ${name} — no address in deployed-mainnet.json`);
      continue;
    }

    const contract = new ethers.Contract(address, OWNABLE_ABI, deployer);
    const currentOwner: string = await contract.owner();

    if (currentOwner.toLowerCase() === SAFE_ADDRESS.toLowerCase()) {
      console.log(`  SKIP  ${name} — already owned by Safe`);
      continue;
    }

    if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log(`  SKIP  ${name} — current owner is ${currentOwner}, not this wallet`);
      continue;
    }

    process.stdout.write(`  ${name.padEnd(15)} transferOwnership → Safe ... `);
    const tx = await contract.transferOwnership(SAFE_ADDRESS);
    await tx.wait();

    const newOwner: string = await contract.owner();
    if (newOwner.toLowerCase() !== SAFE_ADDRESS.toLowerCase()) {
      throw new Error(`${name}: ownership transfer failed — owner is still ${newOwner}`);
    }
    console.log(`✓  (tx: ${tx.hash})`);
  }

  console.log();
  console.log('── Ownership summary ─────────────────────────────────────────');
  for (const { name, address } of contracts) {
    if (!address) continue;
    const contract = new ethers.Contract(address, OWNABLE_ABI, deployer);
    const owner: string = await contract.owner();
    const tag = owner.toLowerCase() === SAFE_ADDRESS.toLowerCase() ? '✓ Safe' : `  ${owner}`;
    console.log(`  ${name.padEnd(15)} ${tag}`);
  }
  console.log('──────────────────────────────────────────────────────────────');
  console.log();
  console.log('All proxy owners transferred to Safe.');
  console.log('Future upgrades and owner calls must go through:');
  console.log(`  https://app.safe.global/celo:${SAFE_ADDRESS}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
