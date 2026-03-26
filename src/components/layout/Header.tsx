/**
 * AlphaScan v4.0 PRO - Header
 * Logo: "ALPHA" (Orbitron Bold) + "SCAN" (Mono) + FL-Icon
 * Tagline: "LIVE Arbitrage Intelligence"
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Shield, Activity } from 'lucide-react';

import { useAuthStore, useScanStore, useUIStore } from '../../lib/store';
import { authApi } from '../../lib/api';
import ScanCounter from '../scan/ScanCounter';
import WalletStatus from '../wallet/WalletStatus';

export default function Header() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const { tier } = useScanStore();
  const { setAuthModal, setWalletModal } = useUIStore();

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    logout();
  };

  const tierColors: Record<string, string> = {
    free: 'text-slate-400',
    daily: 'text-blue-400',
    weekly: 'text-green-400',
    weekly_pro: 'text-emerald-400',
    monthly: 'text-yellow-400',
    monthly_pro: 'text-amber-400',
    monthly_ultra: 'text-orange-400',
    half_year: 'text-red-400',
    yearly: 'text-purple-400',
  };

  return (
    <header className="glass sticky top-0 z-50 px-6 lg:px-10 py-4 flex items-center justify-between border-b border-yellow-500/20">
      {/* Logo */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <span className="text-[9px] font-orbitron font-black tracking-[0.5em] text-yellow-500 uppercase mb-0.5">
            FAMILYLABORATORIES
          </span>
          <div className="flex items-baseline gap-1">
            {/* FL Icon */}
            <div className="w-7 h-7 rounded-lg bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center mr-1">
              <span className="font-orbitron font-black text-yellow-400 text-[10px]">FL</span>
            </div>
            {/* ALPHA in Orbitron Bold */}
            <h1 className="font-orbitron text-2xl font-black tracking-tighter text-white uppercase leading-none">
              ALPHA
            </h1>
            {/* SCAN in Mono */}
            <span className="font-mono text-2xl font-bold text-yellow-500 uppercase leading-none tracking-tight">
              SCAN
            </span>
            <span className="ml-2 text-[9px] bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-mono tracking-normal">
              v4.0 PRO
            </span>
          </div>
          {/* Tagline */}
          <span className="text-[9px] font-mono text-slate-500 tracking-[0.3em] uppercase mt-0.5">
            <span className="text-yellow-500/70">●</span> LIVE Arbitrage Intelligence
          </span>
        </div>

        {/* Status indicator */}
        <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono tracking-[0.3em] text-slate-500 border-l border-white/10 pl-6">
          <Activity className="w-3 h-3 text-yellow-500 animate-pulse" />
          ENTERPRISE WEB3 TERMINAL
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 lg:gap-5">
        {/* Tier Badge */}
        {isAuthenticated && tier !== 'free' && (
          <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono uppercase tracking-widest ${tierColors[tier] || 'text-yellow-400'}`}>
            <Shield className="w-3 h-3" />
            {tier.replace('_', ' ').toUpperCase()}
          </div>
        )}

        {/* Scan Counter */}
        {isAuthenticated && <ScanCounter />}

        {/* Wallet Status */}
        <WalletStatus />

        {/* Auth Buttons */}
        {!isAuthenticated ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAuthModal(true, 'login')}
              className="text-[11px] font-mono text-slate-400 hover:text-white transition-colors uppercase tracking-widest px-3 py-2"
            >
              Login
            </button>
            <button
              onClick={() => setAuthModal(true, 'register')}
              className="bg-yellow-500 hover:bg-yellow-600 text-black px-5 py-2.5 rounded-xl text-[11px] font-black transition-all uppercase tracking-[0.2em] shadow-lg shadow-yellow-500/20"
            >
              Registrieren
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWalletModal(true)}
              className="bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 px-4 py-2.5 rounded-xl text-[11px] font-black transition-all uppercase tracking-[0.15em]"
            >
              <Zap className="w-3 h-3 inline mr-1" />
              Wallet
            </button>
            <button
              onClick={handleLogout}
              className="text-[11px] font-mono text-slate-500 hover:text-red-400 transition-colors uppercase tracking-widest px-3 py-2"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
