/**
 * AlphaScan v4.0 PRO - Hero Section
 * Slogan: "AlphaScan findet. Du tradest."
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Scan, AlertCircle } from 'lucide-react';
import { useAuthStore, useScanStore, useUIStore } from '../../lib/store';

interface HeroSectionProps {
  onScan: () => void;
  scanError: string | null;
}

export default function HeroSection({ onScan, scanError }: HeroSectionProps) {
  const { isAuthenticated } = useAuthStore();
  const { remainingScans, tier } = useScanStore();
  const { setPaymentModal } = useUIStore();

  const canScan = isAuthenticated && remainingScans > 0;

  return (
    <section className="relative pt-32 pb-24 px-6 text-center overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[700px] bg-yellow-600/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block px-6 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-black tracking-[0.5em] uppercase mb-10"
        >
          FamilyLaboratories Web3 Enterprise · v4.0 PRO
        </motion.div>

        {/* Main Title */}
        <motion.h2
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="font-orbitron text-7xl md:text-[9rem] font-black mb-8 tracking-tighter uppercase gold-glow leading-none"
        >
          ALPHA <span className="gold-gradient">SCAN</span>
        </motion.h2>

        {/* Slogan */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-slate-400 max-w-3xl mx-auto mb-4 text-xl font-light tracking-[0.15em] leading-relaxed uppercase"
        >
          Hyperprecise Prediction Arbitrage Scanner.
          <br />
          <span className="text-yellow-500 font-bold">Web3 Secured. Build for Billions.</span>
        </motion.p>

        {/* Slogan DE */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-slate-500 text-sm font-mono tracking-[0.3em] uppercase mb-16"
        >
          "AlphaScan findet. Du tradest."
        </motion.p>

        {/* Scan Error */}
        {scanError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 text-red-400 text-sm font-mono mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-6 py-3 max-w-md mx-auto"
          >
            <AlertCircle className="w-4 h-4" />
            {scanError}
          </motion.div>
        )}

        {/* Scan Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-center gap-4"
        >
          <button
            onClick={onScan}
            disabled={isAuthenticated && remainingScans <= 0}
            className={`group relative px-16 py-7 rounded-[2rem] font-orbitron font-black text-2xl transition-all uppercase tracking-tighter
              ${canScan || !isAuthenticated
                ? 'bg-yellow-500 text-black hover:scale-105 shadow-[0_20px_60px_rgba(251,191,36,0.3)] hover:shadow-[0_30px_80px_rgba(251,191,36,0.5)]'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
          >
            <span className="relative z-10 flex items-center gap-3">
              <Scan className="w-6 h-6" />
              {!isAuthenticated ? 'Login zum Scannen' : remainingScans <= 0 ? 'Upgrade Required' : 'Live Scan Ausführen'}
            </span>
            {(canScan || !isAuthenticated) && (
              <div className="absolute inset-0 bg-yellow-400 rounded-[2rem] blur-3xl opacity-0 group-hover:opacity-40 transition-all" />
            )}
          </button>

          {/* Upgrade hint */}
          {isAuthenticated && remainingScans <= 0 && (
            <button
              onClick={() => setPaymentModal(true)}
              className="text-yellow-500 hover:text-yellow-400 text-sm font-mono uppercase tracking-widest transition-colors"
            >
              → Tier upgraden für mehr Scans
            </button>
          )}

          {/* Scan count hint */}
          {isAuthenticated && remainingScans > 0 && (
            <p className="text-slate-500 text-[11px] font-mono uppercase tracking-widest">
              {remainingScans} Scan{remainingScans !== 1 ? 's' : ''} verfügbar
              {tier !== 'free' && ` · ${tier.replace('_', ' ').toUpperCase()} Tier`}
            </p>
          )}
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap justify-center gap-4 mt-16"
        >
          {[
            '🔗 Chainlink Oracle',
            '👻 Phantom · Backpack · Solflare',
            '🦊 MetaMask · Rabby',
            '🔐 SIWE Auth',
            '⚡ Live Arbitrage',
            '📊 9 Tier Plans',
          ].map((feat) => (
            <span
              key={feat}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400 uppercase tracking-widest"
            >
              {feat}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
