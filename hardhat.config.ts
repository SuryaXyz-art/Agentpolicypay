import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox";
import type { HardhatUserConfig } from "hardhat/config";

const privateKey = process.env.PRIVATE_KEY;
const ogRpcUrl = process.env.OG_RPC_URL;
const ogChainId = process.env.OG_CHAIN_ID ? Number(process.env.OG_CHAIN_ID) : undefined;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "paris",
      viaIR: true
    }
  },
  networks: {
    hardhat: {},
    og: {
      url: ogRpcUrl || "https://evmrpc-testnet.0g.ai",
      chainId: ogChainId ?? 16602,
      accounts: privateKey ? [privateKey] : []
    },
    aristotle: {
      url: process.env.OG_MAINNET_RPC_URL || "https://evmrpc.0g.ai",
      chainId: 16661,
      accounts: privateKey ? [privateKey] : []
    }
  },
  etherscan: {
    apiKey: { og: process.env.OG_EXPLORER_API_KEY || "PLACEHOLDER", aristotle: process.env.OG_EXPLORER_API_KEY || "PLACEHOLDER" },
    customChains: [
      { network: "og", chainId: 16602, urls: { apiURL: "https://chainscan-galileo.0g.ai/open/api", browserURL: "https://chainscan-galileo.0g.ai" } },
      { network: "aristotle", chainId: 16661, urls: { apiURL: "https://chainscan.0g.ai/open/api", browserURL: "https://chainscan.0g.ai" } }
    ]
  }
};

export default config;
