/**
 * AlphaScan v4.0 PRO - Main App
 * FamilyLaboratories | LIVE Arbitrage Intelligence
 */

import React, { useEffect, useMemo } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { clusterApiUrl } from '@solana/web3.js';

import { wagmiConfig } from './lib/wagmi';
import { authApi } from './lib/api';
import { useAuthStore, useScanStore } from './lib/store';

import AlphaScanApp from './components/AlphaScanApp';

import '@solana/wallet-adapter-react-ui/styles.css';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

export default function App() {
  const { setUser } = useAuthStore();
  const { setScans } = useScanStore();

  // Solana wallet adapters
  const solanaWallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  // Check session on mount
  useEffect(() => {
    authApi.me()
      .then(({ user }) => {
        setUser(user);
        setScans(user.remaining_scans, user.total_scans_used, user.tier, user.expiry_date);
      })
      .catch(() => {
        setUser(null);
      });
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider endpoint={clusterApiUrl('mainnet-beta')}>
          <WalletProvider wallets={solanaWallets} autoConnect={false}>
            <WalletModalProvider>
              <AlphaScanApp />
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
