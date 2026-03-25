/**
 * AlphaScan v4.0 PRO - Wagmi EVM Config
 * Supports: MetaMask, Rabby (injected), WalletConnect
 */

import { createConfig, http } from 'wagmi';
import { mainnet, polygon, arbitrum } from 'wagmi/chains';
import { injected, metaMask } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [mainnet, polygon, arbitrum],
  connectors: [
    metaMask({
      dappMetadata: {
        name: 'AlphaScan v4.0 PRO',
        url: 'https://alphascan.famlabs.workers.dev',
        iconUrl: 'https://alphascan.famlabs.workers.dev/logo.png',
      },
    }),
    injected({
      target: 'metaMask',
    }),
    // Rabby is injected as window.ethereum with isRabby flag
    injected({
      target() {
        return {
          id: 'rabby',
          name: 'Rabby',
          provider: typeof window !== 'undefined'
            ? (window as any).rabby || (window as any).ethereum
            : undefined,
        };
      },
    }),
  ],
  transports: {
    [mainnet.id]: http('https://cloudflare-eth.com'),
    [polygon.id]: http('https://polygon-rpc.com'),
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
  },
});

export const SUPPORTED_CHAINS = [mainnet, polygon, arbitrum];
