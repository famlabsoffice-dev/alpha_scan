/**
 * AlphaScan v4.0 PRO - Solana Wallet Adapter Config
 * Supports: Phantom, Backpack, Solflare
 */

import { clusterApiUrl } from '@solana/web3.js';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';

// Backpack adapter (dynamic import to handle missing package)
let BackpackWalletAdapter: any = null;
try {
  // @ts-ignore
  const mod = await import('@solana/wallet-adapter-backpack');
  BackpackWalletAdapter = mod.BackpackWalletAdapter;
} catch {
  // Backpack not installed, skip
}

export const SOLANA_NETWORK = 'mainnet-beta';
export const SOLANA_ENDPOINT = clusterApiUrl(SOLANA_NETWORK);

export function getSolanaWallets() {
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ];

  if (BackpackWalletAdapter) {
    wallets.push(new BackpackWalletAdapter());
  }

  return wallets;
}

export const SOLANA_WALLETS_STATIC = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
];
