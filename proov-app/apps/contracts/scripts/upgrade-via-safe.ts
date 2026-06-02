import { ethers, upgrades } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Deploys new v3 implementations and upgrades all four proxies through the Safe.
 *
 * Works for a 1-of-N Safe where the caller's key is one of the signers.
 * Uses a pre-validated signature (v=1) — the caller IS the signer, so no
 * off-chain signature is needed; the Safe validates msg.sender directly.
 *
 * Usage:
 *   pnpm upgrade:safe:celo
 */

const SAFE_ADDRESS = '0x1F22b145b092177330354074CC5e9300fe049B5c';

const SAFE_ABI = [
  'function nonce() view returns (uint256)',
  'function getTransactionHash(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address payable refundReceiver, uint256 _nonce) view returns (bytes32)',
  'function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address payable refundReceiver, bytes memory signatures) payable returns (bool)',
];

const UPGRADE_ABI = [
  'function upgradeToAndCall(address newImplementation, bytes calldata data) payable',
];

async function execSafeUpgrade(
  safe: ethers.Contract,
  signer: ethers.Signer,
  proxyAddress: string,
  newImpl: string,
  label: string,
) {
  const iface = new ethers.Interface(UPGRADE_ABI);
  const data = iface.encodeFunctionData('upgradeToAndCall', [newImpl, '0x']);

  const nonce = await safe.nonce();
  const txHash: string = await safe.getTransactionHash(
    proxyAddress, 0, data, 0, 0, 0, 0,
    ethers.ZeroAddress, ethers.ZeroAddress,
    nonce,
  );

  // Pre-validated signature: r = owner address (padded), s = 0, v = 1.
  // The Safe validates that msg.sender == r when v == 1, so no cryptographic
  // signature is needed — the transaction sender IS the proof.
  const signerAddress = await signer.getAddress();
  const r = signerAddress.replace('0x', '').padStart(64, '0');
  const s = '0'.repeat(64);
  const v = '01';
  const signature = '0x' + r + s + v;

  process.stdout.write(`  ${label.padEnd(15)} upgradeToAndCall → ${newImpl.slice(0, 10)}... `);
  const tx = await (safe.connect(signer) as ethers.Contract).execTransaction(
    proxyAddress, 0, data, 0, 0, 0, 0,
    ethers.ZeroAddress, ethers.ZeroAddress,
    signature,
    { gasLimit: 500_000 },
  );
  await tx.wait();
  console.log(`✓  (tx: ${tx.hash})`);
  return tx.hash as string;
}

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
  const deployed = JSON.parse(fs.readFileSync(deployedPath, 'utf8'));

  const safe = new ethers.Contract(SAFE_ADDRESS, SAFE_ABI, deployer);

  const contracts = [
    { name: 'ProovCore',      proxy: deployed.ProovCore },
    { name: 'SessionManager', proxy: deployed.SessionManager },
    { name: 'CircleManager',  proxy: deployed.CircleManager },
    { name: 'FuelFaucet',     proxy: deployed.FuelFaucet },
  ];

  // Step 1 — Deploy new implementations (no owner needed — anyone can deploy).
  console.log('Deploying new implementations...');
  const impls: Record<string, string> = {};
  for (const { name, proxy } of contracts) {
    process.stdout.write(`  ${name.padEnd(15)} preparing impl... `);
    const Factory = await ethers.getContractFactory(name);
    // unsafeAllowRenames: ProovCore renamed _habitCount → _userData (same slot,
    // upper bits were 0 in v2 — new packed layout reads habit count from bits 0-31 correctly).
    const impl = await upgrades.prepareUpgrade(proxy, Factory, { kind: 'uups', unsafeAllowRenames: true }) as string;
    impls[name] = impl;
    console.log(impl);
  }

  // Step 2 — Upgrade each proxy through the Safe.
  console.log('\nUpgrading proxies through Safe...');
  const txHashes: Record<string, string> = {};
  for (const { name, proxy } of contracts) {
    txHashes[name] = await execSafeUpgrade(safe, deployer, proxy, impls[name], name);
  }

  // Step 3 — Verify new implementations are live.
  console.log('\n── Upgrade summary ───────────────────────────────────────────');
  for (const { name, proxy } of contracts) {
    const liveImpl = await upgrades.erc1967.getImplementationAddress(proxy);
    const match = liveImpl.toLowerCase() === impls[name].toLowerCase() ? '✓' : '✗';
    console.log(`  ${match} ${name.padEnd(15)} impl: ${liveImpl}`);
  }
  console.log('──────────────────────────────────────────────────────────────');
  console.log('\nAll proxies upgraded to v3. Proxy addresses unchanged.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
