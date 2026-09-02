import { defineChain } from "viem";

const galileo = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc-testnet.0g.ai"] } },
  blockExplorers: { default: { name: "0G Explorer", url: "https://chainscan-galileo.0g.ai" } },
  testnet: true
});

const aristotle = defineChain({
  id: 16661,
  name: "0G Aristotle Mainnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc.0g.ai"] } },
  blockExplorers: { default: { name: "0G Explorer", url: "https://chainscan.0g.ai" } }
});

const configuredChain = process.env.NEXT_PUBLIC_OG_CHAIN_ID?.trim() || "16602";
if (configuredChain !== "16602" && configuredChain !== "16661") throw new Error("NEXT_PUBLIC_OG_CHAIN_ID must be 16602 or 16661.");

// A deliberate build-time switch: never infer mainnet from an address or relabel a legacy receipt.
export const activeChain = configuredChain === "16661" ? aristotle : galileo;
export const ACTIVE_CHAIN_ID = activeChain.id;
export const ACTIVE_NETWORK_NAME = activeChain.name;

export function receiptExplorerUrl(chainId: number | undefined, transactionHash: string | undefined) {
  if (!transactionHash || !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) return undefined;
  const network = chainId === 16661 ? aristotle : chainId === 16602 ? galileo : undefined;
  return network ? `${network.blockExplorers.default.url}/tx/${transactionHash}` : undefined;
}
