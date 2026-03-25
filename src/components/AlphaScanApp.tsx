/**
 * AlphaScan v4.0 PRO - Main Application Component
 * FamilyLaboratories | LIVE Arbitrage Intelligence
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuthStore, useScanStore, useUIStore } from '../lib/store';
import { scanApi, authApi } from '../lib/api';

import Header from './layout/Header';
import AuthModal from './layout/AuthModal';
import WalletModal from './wallet/WalletModal';
import PaymentModal from './payment/PaymentModal';
import ScanResults from './scan/ScanResults';
import LoadingOverlay from './scan/LoadingOverlay';
import HeroSection from './layout/HeroSection';
import ScanCounter from './scan/ScanCounter';

export default function AlphaScanApp() {
  const { isAuthenticated, user } = useAuthStore();
  const { remainingScans, isScanning, setScanning, setScanData, lastScanData } = useScanStore();
  const { showPaymentModal, showAuthModal, showWalletModal, setPaymentModal, setAuthModal } = useUIStore();

  const [showResults, setShowResults] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'ARB' | 'UNDERDOG' | 'SOLANA'>('ALL');
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    if (!isAuthenticated) {
      setAuthModal(true, 'login');
      return;
    }

    if (remainingScans <= 0) {
      setPaymentModal(true);
      return;
    }

    setScanError(null);
    setScanning(true);

    try {
      // Deduct scan counter
      const scanResult = await scanApi.execute();

      // Fetch arbitrage data
      const [dataResult] = await Promise.all([
        scanApi.getData(),
        new Promise(r => setTimeout(r, 1500)), // min loading time for UX
      ]);

      // Fetch market data from original worker
      const workerData = await fetchWorkerData();

      setScanData({ ...workerData, crypto: dataResult.crypto, scanResult });
      setShowResults(true);
    } catch (err: any) {
      if (err?.error === 'SCAN_LIMIT_REACHED') {
        setPaymentModal(true);
      } else {
        setScanError(err?.message || 'Scan fehlgeschlagen');
      }
    } finally {
      setScanning(false);
    }
  }, [isAuthenticated, remainingScans]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-yellow-500/30">
      {/* Scan Line */}
      <div className="scan-line" />

      {/* Modals */}
      <AnimatePresence>
        {showAuthModal && <AuthModal />}
        {showWalletModal && <WalletModal />}
        {showPaymentModal && <PaymentModal />}
      </AnimatePresence>

      {/* Loading */}
      <AnimatePresence>
        {isScanning && <LoadingOverlay />}
      </AnimatePresence>

      {/* Header */}
      <Header />

      {/* Main Content */}
      <main>
        {!showResults ? (
          <HeroSection onScan={handleScan} scanError={scanError} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <ScanResults
              data={lastScanData}
              filter={filter}
              onFilterChange={setFilter}
              onRescan={handleScan}
            />
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-10 py-20 border-t border-yellow-500/20 text-center">
        <div className="mb-8 flex justify-center gap-16 uppercase tracking-[0.8em] font-black text-[11px] text-slate-500">
          <span className="hover:text-yellow-500 transition-colors cursor-default">C•J•V•K</span>
          <span className="hover:text-yellow-500 transition-colors cursor-default">© 2026 FamilyLaboratories</span>
          <span className="hover:text-yellow-500 transition-colors cursor-default">Build in 4 - Build for Billions</span>
        </div>
        <p className="max-w-4xl mx-auto opacity-40 text-[11px] leading-loose uppercase tracking-[0.2em] font-medium">
          Alle Daten werden in Echtzeit über öffentliche APIs aggregiert. Arbitrage-Chancen auf Solana (Monaco/Hxro) nutzen identische SPL-Outcome-Tokens.
          Ein Produkt von <span className="text-yellow-500 font-bold">FamilyLaboratories</span>.
        </p>
      </footer>
    </div>
  );
}

// Fetch from original Cloudflare Worker
async function fetchWorkerData() {
  const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://alphascan.famlabsoffice.workers.dev';
  try {
    const res = await fetch(`${WORKER_URL}/?auth=TGMFAM2026`);
    if (!res.ok) throw new Error('Worker error');
    return await res.json();
  } catch {
    return { opportunities: [], markets: [], crypto: {}, status: 'FALLBACK' };
  }
}
