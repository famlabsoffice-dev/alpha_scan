/**
 * AlphaScan v4.0 PRO - Wallet Status (Header)
 * Zeigt verbundene Wallet-Adresse + Balance
 */

import React from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuthStore, useUIStore } from '../../lib/store';

export default function WalletStatus() {
  const { user, isAuthenticated } = useAuthStore();
  const { setWalletModal } = useUIStore();

  // EVM
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { data: evmBalance } = useBalance({ address: evmAddress });

  // Solana
  const { publicKey, connected: solConnected } = useWallet();

  if (!isAuthenticated) return null;

  const hasWallet = evmConnected || solConnected;
  const displayAddress = evmConnected
    ? `${evmAddress?.slice(0, 6)}...${evmAddress?.slice(-4)}`
    : solConnected
    ? `${publicKey?.toBase58().slice(0, 6)}...${publicKey?.toBase58().slice(-4)}`
    : user?.wallet
    ? `${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}`
    : null;

  const chain = evmConnected ? 'ETH' : solConnected ? 'SOL' : user?.wallet_chain?.toUpperCase() || null;

  if (!displayAddress) {
    return (
      <button
        onClick={() => setWalletModal(true)}
        className="hidden md:flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl border border-white/10 hover:border-yellow-500/30 text-[10px] font-mono transition-all"
      >
        <span className="text-slate-500 uppercase tracking-widest">Wallet:</span>
        <span className="text-yellow-400 font-bold">NOT CONNECTED</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setWalletModal(true)}
      className="hidden md:flex items-center gap-3 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl border border-white/10 hover:border-yellow-500/30 transition-all group"
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
          {chain}:
        </span>
        <span className="text-[10px] font-mono text-yellow-400 font-bold">
          {displayAddress}
        </span>
      </div>
      {evmConnected && evmBalance && (
        <span className="text-[10px] font-mono text-slate-500 border-l border-white/10 pl-3">
          {parseFloat(evmBalance.formatted).toFixed(4)} {evmBalance.symbol}
        </span>
      )}
    </button>
  );
}
