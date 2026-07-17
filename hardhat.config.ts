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
      }
    }
  },
  networks: {
    hardhat: {},
    og: {
      url: ogRpcUrl || "",
      chainId: ogChainId,
      accounts: privateKey ? [privateKey] : []
    }
  }
};

export default config;
