"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider, connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coin98Wallet,
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  okxWallet,
  rabbyWallet,
  walletConnectWallet
} from "@rainbow-me/rainbowkit/wallets";
import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineChain } from "viem";
import { ReactNode, useState } from "react";

const zeroGTestnet = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] }
  },
  blockExplorers: {
    default: { name: "0G Explorer", url: "https://chainscan-galileo.0g.ai" }
  },
  testnet: true
});

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || "demo";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, okxWallet, rabbyWallet, injectedWallet]
    },
    {
      groupName: "More wallets",
      wallets: [walletConnectWallet, coinbaseWallet, coin98Wallet]
    }
  ],
  {
    appName: "Apolo Mind",
    projectId: walletConnectProjectId
  }
);

const config = createConfig({
  chains: [zeroGTestnet],
  connectors,
  transports: {
    [zeroGTestnet.id]: http(zeroGTestnet.rpcUrls.default.http[0])
  },
  ssr: true
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

