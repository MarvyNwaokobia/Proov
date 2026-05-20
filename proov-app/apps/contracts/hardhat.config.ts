import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun", // REQUIRED — Celo migrated to L2 in March 2025
    },
  },
  networks: {
    celoSepolia: {
      url: "https://forno.celo-sepolia.celo-testnet.org",
      chainId: 11142220,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    celo: {
      url: "https://forno.celo.org",
      chainId: 42220,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
  etherscan: {
    // Etherscan V2 unified API — single key covers all chains
    apiKey: process.env.CELOSCAN_API_KEY || "",
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=42220",
          browserURL: "https://celoscan.io",
        },
      },
      {
        network: "celoSepolia",
        chainId: 11142220,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=11142220",
          browserURL: "https://sepolia.celoscan.io",
        },
      },
    ],
  },
};

export default config;
