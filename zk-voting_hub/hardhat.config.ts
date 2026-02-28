import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox"; // Includes ethers v6, etherscan, chai, etc.
import * as dotenv from "dotenv";

// MUST load environment variables before accessing process.env
dotenv.config();

// Safely retrieve variables without using invalid dummy keys
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  // Specify the Solidity version that matches your contracts
  solidity: {
    compilers: [
      {
        version: "0.8.21", // Updated to match your Hub and Verifier contracts
        settings: {
          optimizer: {
            enabled: true,
            runs: 200, // Optimizes for lower gas costs during execution
          },
        },
      },
      {
        version: "0.8.0", // Fallback for older dependencies
      }
    ],
  },
  
  // Network configurations
  networks: {
    // Local Hardhat node for fast, free testing
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Sepolia Testnet for production-like deployment
    sepolia: {
      url: SEPOLIA_RPC_URL,
      // Only inject the account if the PRIVATE_KEY is defined in the .env file.
      // This prevents Hardhat from crashing due to an invalid 0x00000 key.
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },

  // Etherscan integration for automated contract verification
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },

  // Optional: Paths configuration to keep the project strictly organized
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;