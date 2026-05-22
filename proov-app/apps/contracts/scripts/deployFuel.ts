import { ethers } from 'hardhat';

async function main() {
  console.log('Deploying FuelFaucet to Celo Mainnet...');

  const FuelFaucet = await ethers.getContractFactory('FuelFaucet');
  const faucet = await FuelFaucet.deploy();
  await faucet.waitForDeployment();

  const address = await faucet.getAddress();
  console.log('FuelFaucet deployed to:', address);
  console.log('Now fund it with CELO:');
  console.log(`  cast send ${address} --value 100ether --rpc-url https://forno.celo.org`);
  console.log('Or send CELO directly to the address from your wallet.');
}

main().catch(console.error);
