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
import { ReactNode, useState } from "react";
import { activeChain } from "@/lib/network";

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
  chains: [activeChain],
  connectors,
  transports: {
    16602: http("https://evmrpc-testnet.0g.ai"),
    16661: http("https://evmrpc.0g.ai")
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

