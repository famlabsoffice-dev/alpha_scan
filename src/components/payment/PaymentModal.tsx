/**
 * AlphaScan v4.0 PRO - Payment Modal
 * Vollständiges Tier-System mit EVM + Solana Payments
 * Chainlink ETH/USD Preisorakel
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Zap, Shield, Crown, Star } from 'lucide-react';

import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

import { paymentApi, type Tier } from '../../lib/api';
import { useAuthStore, useScanStore, useUIStore } from '../../lib/store';

const TIER_ICONS: Record<string, React.ReactNode> = {
  free: <Shield className="w-4 h-4" />,
  daily: <Zap className="w-4 h-4" />,
  weekly: <Star className="w-4 h-4" />,
  weekly_pro: <Star className="w-4 h-4" />,
  monthly: <Crown className="w-4 h-4" />,
  monthly_pro: <Crown className="w-4 h-4" />,
  monthly_ultra: <Crown className="w-4 h-4" />,
  half_year: <Crown className="w-4 h-4" />,
  yearly: <Crown className="w-4 h-4" />,
};

const TIER_COLORS: Record<string, string> = {
  free: 'border-slate-500/30 bg-slate-500/5',
  daily: 'border-blue-500/30 bg-blue-500/5',
  weekly: 'border-green-500/30 bg-green-500/5',
  weekly_pro: 'border-emerald-500/30 bg-emerald-500/5',
  monthly: 'border-yellow-500/30 bg-yellow-500/5',
  monthly_pro: 'border-amber-500/30 bg-amber-500/5',
  monthly_ultra: 'border-orange-500/30 bg-orange-500/5',
  half_year: 'border-red-500/30 bg-red-500/5',
  yearly: 'border-purple-500/30 bg-purple-500/5',
};

const TIER_HIGHLIGHT: Record<string, string> = {
  monthly_pro: 'ring-2 ring-yellow-500/50',
  yearly: 'ring-2 ring-purple-500/50',
};

export default function PaymentModal() {
  const { setPaymentModal } = useUIStore();
  const { user, setUser } = useAuthStore();
  const { setScans } = useScanStore();

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [ethUsd, setEthUsd] = useState('');
  const [solUsd, setSolUsd] = useState('');
  const [receiverEth, setReceiverEth] = useState('');
  const [receiverSol, setReceiverSol] = useState('');
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [paymentChain, setPaymentChain] = useState<'evm' | 'solana'>('evm');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | 'pending'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTiers, setLoadingTiers] = useState(true);

  // EVM
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();

  // Solana
  const { publicKey, sendTransaction: solSendTransaction, connected: solConnected } = useWallet();
  const { connection } = useConnection();

  useEffect(() => {
    paymentApi.getTiers()
      .then((data) => {
        setTiers(data.tiers.filter(t => t.key !== 'free'));
        setEthUsd(data.eth_usd);
        setSolUsd(data.sol_usd);
        setReceiverEth(data.receiver_eth);
        setReceiverSol(data.receiver_sol);
      })
      .catch(() => setStatus({ type: 'error', message: 'Tier-Preise konnten nicht geladen werden' }))
      .finally(() => setLoadingTiers(false));
  }, []);

  // ─── EVM Payment ─────────────────────────────────────────────────────────────

  const handleEvmPayment = useCallback(async () => {
    if (!selectedTier || !evmAddress || !receiverEth) return;
    setLoading(true);
    setStatus({ type: 'pending', message: 'Transaktion wird vorbereitet...' });

    try {
      const ethAmount = parseEther(selectedTier.price_eth);

      setStatus({ type: 'pending', message: 'Bitte in MetaMask/Rabby bestätigen...' });
      const txHash = await sendTransactionAsync({
        to: receiverEth as `0x${string}`,
        value: ethAmount,
      });

      setStatus({ type: 'pending', message: `TX gesendet: ${txHash.slice(0, 10)}... Warte auf Bestätigung...` });

      // Wait a bit for tx to propagate
      await new Promise(r => setTimeout(r, 3000));

      setStatus({ type: 'pending', message: 'Backend verifiziert Transaktion...' });
      const result = await paymentApi.verifyEvm(txHash, selectedTier.key, evmAddress);

      // Refresh user
      const { authApi } = await import('../../lib/api');
      const { user: updatedUser } = await authApi.me();
      setUser(updatedUser);
      setScans(updatedUser.remaining_scans, updatedUser.total_scans_used, updatedUser.tier, updatedUser.expiry_date);

      setStatus({
        type: 'success',
        message: `✓ ${result.tier_name} aktiviert! ${result.remaining_scans} Scans verfügbar.`,
      });

      setTimeout(() => setPaymentModal(false), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.error || err?.message || 'Zahlung fehlgeschlagen' });
    } finally {
      setLoading(false);
    }
  }, [selectedTier, evmAddress, receiverEth, sendTransactionAsync]);

  // ─── Solana Payment ───────────────────────────────────────────────────────────

  const handleSolanaPayment = useCallback(async () => {
    if (!selectedTier || !publicKey || !receiverSol) return;
    setLoading(true);
    setStatus({ type: 'pending', message: 'Solana TX wird vorbereitet...' });

    try {
      const lamports = Math.floor(parseFloat(selectedTier.price_sol) * LAMPORTS_PER_SOL);
      const receiverPubKey = new PublicKey(receiverSol);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: receiverPubKey,
          lamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      setStatus({ type: 'pending', message: 'Bitte in Phantom/Backpack/Solflare bestätigen...' });
      const txSignature = await solSendTransaction(transaction, connection);

      setStatus({ type: 'pending', message: `TX: ${txSignature.slice(0, 10)}... Warte auf Bestätigung...` });
      await connection.confirmTransaction(txSignature, 'confirmed');

      setStatus({ type: 'pending', message: 'Backend verifiziert Solana TX...' });
      const result = await paymentApi.verifySolana(txSignature, selectedTier.key, publicKey.toBase58());

      const { authApi } = await import('../../lib/api');
      const { user: updatedUser } = await authApi.me();
      setUser(updatedUser);
      setScans(updatedUser.remaining_scans, updatedUser.total_scans_used, updatedUser.tier, updatedUser.expiry_date);

      setStatus({
        type: 'success',
        message: `✓ ${result.tier_name} aktiviert! ${result.remaining_scans} Scans verfügbar.`,
      });

      setTimeout(() => setPaymentModal(false), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.error || err?.message || 'Solana Zahlung fehlgeschlagen' });
    } finally {
      setLoading(false);
    }
  }, [selectedTier, publicKey, receiverSol, solSendTransaction, connection]);

  const handlePay = paymentChain === 'evm' ? handleEvmPayment : handleSolanaPayment;
  const canPay = paymentChain === 'evm' ? evmConnected : solConnected;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[160] bg-slate-950/97 backdrop-blur-2xl flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && setPaymentModal(false)}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="glass p-8 rounded-[2.5rem] max-w-4xl w-full border-yellow-500/30 my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-orbitron text-2xl font-black text-white uppercase tracking-tighter">
              Web3 Upgrade
            </h3>
            <p className="text-slate-400 text-[10px] font-mono uppercase tracking-widest mt-1">
              Chainlink Oracle · ETH: ${ethUsd} · SOL: ${solUsd}
            </p>
          </div>
          <button onClick={() => setPaymentModal(false)} className="text-slate-500 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Payment Chain Toggle */}
        <div className="flex bg-white/5 rounded-2xl p-1 mb-6 max-w-xs">
          {(['evm', 'solana'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setPaymentChain(c)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all
                ${paymentChain === c ? 'bg-yellow-500 text-black' : 'text-slate-400 hover:text-white'}`}
            >
              {c === 'evm' ? '⟠ ETH' : '◎ SOL'}
            </button>
          ))}
        </div>

        {/* Tier Grid */}
        {loadingTiers ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {tiers.map((tier) => (
              <button
                key={tier.key}
                onClick={() => setSelectedTier(selectedTier?.key === tier.key ? null : tier)}
                className={`relative text-left p-4 rounded-2xl border transition-all
                  ${TIER_COLORS[tier.key] || 'border-white/10 bg-white/5'}
                  ${TIER_HIGHLIGHT[tier.key] || ''}
                  ${selectedTier?.key === tier.key ? 'border-yellow-500 bg-yellow-500/10 scale-[1.02]' : 'hover:border-white/20'}
                `}
              >
                {/* Popular badge */}
                {tier.key === 'monthly_pro' && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                    POPULAR
                  </span>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-yellow-500">{TIER_ICONS[tier.key]}</span>
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">{tier.name}</span>
                </div>

                <div className="text-xl font-orbitron font-black text-yellow-400 mb-1">
                  ${tier.price_usd}
                </div>

                <div className="text-[9px] font-mono text-slate-500 mb-2">
                  {paymentChain === 'evm'
                    ? `${parseFloat(tier.price_eth).toFixed(5)} ETH`
                    : `${parseFloat(tier.price_sol).toFixed(3)} SOL`}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-green-400 font-bold">{tier.scans.toLocaleString()} Scans</span>
                  <span className="text-[9px] font-mono text-slate-500">{tier.label}</span>
                </div>

                {selectedTier?.key === tier.key && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="w-4 h-4 text-yellow-500" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Selected Tier Summary */}
        {selectedTier && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 mb-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-400 font-orbitron font-black text-lg">{selectedTier.name}</p>
                <p className="text-slate-400 text-xs font-mono mt-1">
                  {selectedTier.scans.toLocaleString()} Scans · {selectedTier.label}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white font-orbitron font-black text-2xl">${selectedTier.price_usd}</p>
                <p className="text-slate-400 text-xs font-mono">
                  {paymentChain === 'evm'
                    ? `≈ ${parseFloat(selectedTier.price_eth).toFixed(5)} ETH`
                    : `≈ ${parseFloat(selectedTier.price_sol).toFixed(3)} SOL`}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Wallet not connected warning */}
        {selectedTier && !canPay && (
          <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-2xl px-5 py-4 mb-4 text-orange-400 text-sm font-mono">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {paymentChain === 'evm'
              ? 'Bitte MetaMask oder Rabby verbinden'
              : 'Bitte Phantom, Backpack oder Solflare verbinden'}
          </div>
        )}

        {/* Status */}
        {status && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-3 rounded-2xl px-5 py-4 mb-4 text-sm font-mono
              ${status.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                status.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'}`}
          >
            {status.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> :
             status.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> :
             <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
            {status.message}
          </motion.div>
        )}

        {/* Pay Button */}
        <button
          onClick={handlePay}
          disabled={!selectedTier || !canPay || loading}
          className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-slate-700 disabled:text-slate-500 text-black py-5 rounded-2xl font-orbitron font-black uppercase tracking-widest transition-all text-base"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Transaktion läuft...
            </span>
          ) : selectedTier ? (
            `${paymentChain === 'evm' ? '⟠' : '◎'} ${selectedTier.name} kaufen · ${paymentChain === 'evm' ? selectedTier.price_eth + ' ETH' : selectedTier.price_sol + ' SOL'}`
          ) : (
            'Tier auswählen'
          )}
        </button>

        {/* Security note */}
        <p className="text-slate-600 text-[9px] font-mono uppercase tracking-widest text-center mt-4">
          🔐 Chainlink Oracle · On-Chain Verifikation · Kein Drittanbieter
        </p>
      </motion.div>
    </motion.div>
  );
}
