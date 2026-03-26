/**
 * AlphaScan v4.0 PRO - Loading Overlay
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const LOADING_STEPS = [
  'Deep-Scan Initialisierung...',
  'Polymarket CLOB verbinden...',
  'Manifold Markets abrufen...',
  'PredictIt Daten laden...',
  'Chainlink Oracle abfragen...',
  'Arbitrage-Algorithmus läuft...',
  'Top Opportunities berechnen...',
  'Ergebnisse werden sortiert...',
];

export default function LoadingOverlay() {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => Math.min(s + 1, LOADING_STEPS.length - 1));
      setProgress(p => Math.min(p + 100 / LOADING_STEPS.length, 95));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-950/99 backdrop-blur-[40px] flex flex-col items-center justify-center"
    >
      {/* Spinner */}
      <div className="relative w-48 h-48 mb-12">
        <div className="absolute inset-0 border-[1px] border-yellow-500/5 rounded-full" />
        <div className="absolute inset-0 border-t-[3px] border-yellow-500 rounded-full animate-spin" />
        <div className="absolute inset-4 border-t-[2px] border-yellow-500/40 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-orbitron font-black text-2xl uppercase tracking-[0.3em] text-yellow-500">
            SCAN
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-80 h-1 bg-white/10 rounded-full overflow-hidden border border-white/5 mb-6">
        <motion.div
          className="h-full bg-yellow-500 shadow-[0_0_20px_rgba(251,191,36,0.8)]"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Step text */}
      <motion.p
        key={step}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-mono text-[11px] text-yellow-500 font-bold uppercase tracking-[0.8em]"
      >
        {LOADING_STEPS[step]}
      </motion.p>

      {/* AlphaScan label */}
      <p className="font-orbitron text-slate-600 text-[10px] uppercase tracking-[0.5em] mt-4">
        AlphaScan v4.0 PRO · FamilyLaboratories
      </p>
    </motion.div>
  );
}
