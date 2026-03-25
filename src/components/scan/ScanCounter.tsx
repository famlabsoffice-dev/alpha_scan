/**
 * AlphaScan v4.0 PRO - Scan Counter
 * Live-Update via SSE / Polling
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';

import { useScanStore, useUIStore } from '../../lib/store';
import { scanApi } from '../../lib/api';

export default function ScanCounter() {
  const { remainingScans, tier, expiryDate, setScans } = useScanStore();
  const { setPaymentModal } = useUIStore();

  // Poll scan status every 30s
  useEffect(() => {
    const poll = async () => {
      try {
        const status = await scanApi.status();
        setScans(status.remaining_scans, status.total_scans_used, status.tier, status.expiry_date);
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, []);

  const isLow = remainingScans <= 2;
  const isEmpty = remainingScans === 0;

  return (
    <button
      onClick={isEmpty ? () => setPaymentModal(true) : undefined}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[10px] font-mono
        ${isEmpty
          ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 cursor-pointer'
          : isLow
          ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
          : 'bg-white/5 border-white/10 text-slate-400'
        }`}
    >
      <Zap className={`w-3 h-3 ${isEmpty ? 'text-red-400' : isLow ? 'text-orange-400' : 'text-yellow-400'}`} />
      <AnimatePresence mode="wait">
        <motion.span
          key={remainingScans}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          className="font-bold uppercase tracking-widest"
        >
          {remainingScans}
        </motion.span>
      </AnimatePresence>
      <span className="uppercase tracking-widest opacity-60">Scans</span>
      {isEmpty && <span className="text-red-400 font-black">→ Upgrade</span>}
    </button>
  );
}
