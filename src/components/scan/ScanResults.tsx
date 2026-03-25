/**
 * AlphaScan v4.0 PRO - Scan Results
 */

import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, TrendingUp, AlertTriangle, Zap } from 'lucide-react';

interface Market {
  id: string;
  source?: string;
  platform?: string;
  title?: string;
  question?: string;
  yes_price: number;
  no_price: number;
  volume?: number;
  url?: string;
  arb_profit?: number;
  arb_partner?: string;
  yes_net_5?: number;
  yes_net_10?: number;
  yes_net_25?: number;
  reason?: string;
}

interface ScanData {
  opportunities?: any[];
  markets?: Market[];
  crypto?: Record<string, number>;
  status?: string;
}

interface ScanResultsProps {
  data: ScanData | null;
  filter: 'ALL' | 'ARB' | 'UNDERDOG' | 'SOLANA';
  onFilterChange: (f: 'ALL' | 'ARB' | 'UNDERDOG' | 'SOLANA') => void;
  onRescan: () => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  Polymarket: '#2563eb',
  Manifold: '#6366f1',
  PredictIt: '#10b981',
  Monaco: '#f59e0b',
  Hxro: '#ef4444',
  JupiterPM: '#10b981',
  Metaculus: '#ec4899',
};

export default function ScanResults({ data, filter, onFilterChange, onRescan }: ScanResultsProps) {
  if (!data) return null;

  const allMarkets: Market[] = data.markets || [];
  const opportunities = data.opportunities || [];
  const crypto = data.crypto || {};

  // Filter markets
  let filtered = allMarkets;
  if (filter === 'ARB') filtered = allMarkets.filter(m => m.arb_profit && m.arb_profit > 0);
  else if (filter === 'UNDERDOG') filtered = allMarkets.filter(m => m.yes_price < 0.10);
  else if (filter === 'SOLANA') filtered = allMarkets.filter(m => ['Monaco', 'Hxro', 'JupiterPM'].includes(m.platform || m.source || ''));

  // Top 10
  const top10 = [...allMarkets]
    .sort((a, b) => (b.arb_profit || 0) - (a.arb_profit || 0) || (1 / a.yes_price) - (1 / b.yes_price))
    .slice(0, 10);

  // Underdogs
  const underdogs = allMarkets.filter(m => m.yes_price < 0.10).sort((a, b) => a.yes_price - b.yes_price).slice(0, 10);

  return (
    <div className="px-6 lg:px-10 pb-32 max-w-[1600px] mx-auto">
      {/* Crypto Prices Bar */}
      {Object.keys(crypto).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-4 mb-12 py-4 border-b border-white/5"
        >
          {Object.entries(crypto).filter(([k]) => ['SOL', 'BTC', 'ETH', 'ETH_CHAINLINK'].includes(k)).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-slate-500 uppercase tracking-widest">{key}:</span>
              <span className="text-yellow-400 font-bold">${typeof val === 'number' ? val.toLocaleString('en-US', { maximumFractionDigits: 2 }) : val}</span>
              {key === 'ETH_CHAINLINK' && <span className="text-[9px] text-slate-600 uppercase">Chainlink</span>}
            </div>
          ))}
          <button
            onClick={onRescan}
            className="ml-auto flex items-center gap-2 text-[11px] font-mono text-slate-500 hover:text-yellow-400 transition-colors uppercase tracking-widest"
          >
            <RefreshCw className="w-3 h-3" />
            Neu scannen
          </button>
        </motion.div>
      )}

      {/* Top 10 Opportunities */}
      {top10.length > 0 && (
        <section className="mb-20">
          <div className="flex items-center justify-between mb-10">
            <h3 className="font-orbitron text-3xl font-black flex items-center gap-4 uppercase tracking-tighter">
              <TrendingUp className="w-7 h-7 text-yellow-500" />
              Top 10 Opportunities
            </h3>
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-[0.6em] border-b border-yellow-500/30 pb-2">
              Arbitrage & High ROI
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {top10.map((m, i) => (
              <MarketCard key={m.id || i} market={m} isTop />
            ))}
          </div>
        </section>
      )}

      {/* Underdogs */}
      {underdogs.length > 0 && (
        <section className="mb-20">
          <div className="flex items-center justify-between mb-10">
            <h3 className="font-orbitron text-3xl font-black flex items-center gap-4 uppercase tracking-tighter">
              <AlertTriangle className="w-7 h-7 text-yellow-500" />
              Unbeachtete Underdogs
            </h3>
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-[0.6em] border-b border-yellow-500/30 pb-2">
              ROI &gt; 1000% | Price &lt; 10¢
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {underdogs.map((m, i) => (
              <MarketCard key={m.id || i} market={m} isTop />
            ))}
          </div>
        </section>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-8 border-b border-white/5 mb-12 overflow-x-auto no-scrollbar">
        {(['ALL', 'ARB', 'UNDERDOG', 'SOLANA'] as const).map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`pb-6 font-bold text-xs tracking-[0.4em] uppercase transition-all whitespace-nowrap
              ${filter === f ? 'border-b-2 border-yellow-500 text-yellow-500' : 'text-slate-500 hover:text-white opacity-60 hover:opacity-100'}`}
          >
            {f === 'ALL' ? 'Alle Märkte' : f === 'ARB' ? 'Arbitrage 🔥' : f === 'UNDERDOG' ? 'Underdogs ⚠️' : 'Solana Focus'}
          </button>
        ))}
      </div>

      {/* Market Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.slice(0, 60).map((m, i) => (
          <MarketCard key={m.id || i} market={m} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-slate-500 font-mono uppercase tracking-widest">
          Keine Märkte für diesen Filter gefunden
        </div>
      )}
    </div>
  );
}

function MarketCard({ market: m, isTop = false }: { market: Market; isTop?: boolean }) {
  const platform = m.platform || m.source || 'Unknown';
  const question = m.question || m.title || '';
  const platColor = PLATFORM_COLORS[platform] || '#94a3b8';
  const roi = m.yes_price > 0 ? ((1 / m.yes_price) * 100).toFixed(0) : '0';
  const isArb = !!(m.arb_profit && m.arb_profit > 0);
  const isUnderdog = m.yes_price < 0.15;

  const calcProfit = (stake: number, price: number) =>
    price > 0 ? (stake / price - stake).toFixed(2) : '0.00';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass p-7 rounded-[2rem] card-hover flex flex-col gap-5
        ${isTop ? 'border-yellow-500/40 shadow-[0_0_40px_rgba(251,191,36,0.15)]' : ''}`}
    >
      {/* Platform + Tags */}
      <div className="flex justify-between items-start">
        <span
          className="text-[9px] font-mono px-4 py-1.5 rounded-full bg-white/5 border border-white/10 tracking-[0.3em] uppercase font-black"
          style={{ color: platColor }}
        >
          {platform}
        </span>
        <div className="flex gap-2">
          {isArb && (
            <span className="text-[9px] font-mono px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-[0.3em] font-black">
              ARB +{m.arb_profit?.toFixed(1)}%
            </span>
          )}
          {isUnderdog && (
            <span className="text-[9px] font-mono px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 uppercase tracking-[0.3em] font-black">
              UNDERDOG
            </span>
          )}
        </div>
      </div>

      {/* Question */}
      <h4 className="text-base font-bold leading-tight text-white/90 line-clamp-3">{question}</h4>

      {/* Reason */}
      {m.reason && (
        <p className="text-[9px] text-slate-400 uppercase tracking-widest leading-relaxed line-clamp-2">{m.reason}</p>
      )}

      {/* YES/NO Buttons */}
      <div className="flex gap-3">
        <a
          href={`${m.url}?side=YES`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-3 rounded-xl font-orbitron font-black text-center text-sm uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white transition-all hover:scale-105 shadow-lg shadow-emerald-500/20"
        >
          YES ¢{(m.yes_price * 100).toFixed(0)}
        </a>
        <a
          href={`${m.url}?side=NO`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-3 rounded-xl font-orbitron font-black text-center text-sm uppercase tracking-widest bg-red-500 hover:bg-red-600 text-white transition-all hover:scale-105 shadow-lg shadow-red-500/20"
        >
          NO ¢{(m.no_price * 100).toFixed(0)}
        </a>
      </div>

      {/* Profit Tiers */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
        {[5, 10, 25].map((stake) => (
          <div key={stake} className="text-center">
            <div className="text-[8px] text-slate-500 uppercase tracking-[0.2em] mb-1">{stake}€ Profit</div>
            <div className="text-[12px] font-mono text-green-400 font-black">
              +{calcProfit(stake, m.yes_price)}€
            </div>
          </div>
        ))}
      </div>

      {/* ROI */}
      <div className="flex items-center justify-between px-2">
        <div className="text-[9px] text-slate-500 font-mono uppercase tracking-[0.4em]">ROI Potential</div>
        <div className="text-2xl font-orbitron font-black text-yellow-400 tracking-tighter">{roi}%</div>
      </div>

      {/* Details link */}
      {m.url && (
        <a
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center py-3 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black transition-all uppercase tracking-[0.5em] border border-white/5"
        >
          Details ansehen →
        </a>
      )}
    </motion.div>
  );
}
