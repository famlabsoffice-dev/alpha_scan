/**
 * AlphaScan v4.0 PRO - Wallet Modal
 * Solana: Phantom, Backpack, Solflare
 * EVM: MetaMask, Rabby
 * SIWE Auth + Double-Check
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Wallet, Link, Unlink } from 'lucide-react';

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { SiweMessage } from 'siwe';
import bs58 from 'bs58';

import { siweApi } from '../../lib/api';
import { useAuthStore, useScanStore, useUIStore } from '../../lib/store';

export default function WalletModal() {
  const { setWalletModal } = useUIStore();
  const { user, setUser } = useAuthStore();
  const { setScans } = useScanStore();

  const [activeTab, setActiveTab] = useState<'solana' | 'evm'>('evm');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [linking, setLinking] = useState(false);

  // Solana wallet
  const { publicKey, connected: solConnected, connect: solConnect, disconnect: solDisconnect, signMessage: solSignMessage, wallet: solWallet } = useWallet();
  const { setVisible: setSolModalVisible } = useWalletModal();

  // EVM wallet
  const { address: evmAddress, isConnected: evmConnected, chain } = useAccount();
  const { connect: evmConnect, connectors } = useConnect();
  const { disconnect: evmDisconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  // ─── EVM SIWE Link ──────────────────────────────────────────────────────────

  const handleEvmSiwe = useCallback(async () => {
    if (!evmAddress) return;
    setLinking(true);
    setStatus({ type: 'info', message: 'Nonce wird abgerufen...' });

    try {
      const { nonce } = await siweApi.getNonce();

      const message = new SiweMessage({
        domain: window.location.host,
        address: evmAddress,
        statement: 'AlphaScan v4.0 PRO - Wallet verknüpfen. Bitte signiere diese Nachricht.',
        uri: window.location.origin,
        version: '1',
        chainId: chain?.id || 1,
        nonce,
        issuedAt: new Date().toISOString(),
      });

      const msgStr = message.prepareMessage();
      setStatus({ type: 'info', message: 'Bitte in deiner Wallet signieren...' });

      const signature = await signMessageAsync({ message: msgStr });
      setStatus({ type: 'info', message: 'Verifikation läuft...' });

      await siweApi.verifyEvm(msgStr, signature, 'evm');

      // Refresh user
      const { default: authApi } = await import('../../lib/api').then(m => ({ default: m.authApi }));
      const { user: updatedUser } = await authApi.me();
      setUser(updatedUser);
      setScans(updatedUser.remaining_scans, updatedUser.total_scans_used, updatedUser.tier, updatedUser.expiry_date);

      setStatus({ type: 'success', message: `Wallet ${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)} erfolgreich verknüpft!` });
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.error || err?.message || 'Verknüpfung fehlgeschlagen' });
    } finally {
      setLinking(false);
    }
  }, [evmAddress, chain, signMessageAsync]);

  // ─── Solana SIWE Link ───────────────────────────────────────────────────────

  const handleSolanaSiwe = useCallback(async () => {
    if (!publicKey || !solSignMessage) return;
    setLinking(true);
    setStatus({ type: 'info', message: 'Nonce wird abgerufen...' });

    try {
      const { nonce } = await siweApi.getNonce();
      const pubKeyStr = publicKey.toBase58();

      const messageText = [
        'AlphaScan v4.0 PRO - Wallet verknüpfen',
        '',
        `Adresse: ${pubKeyStr}`,
        `Nonce: ${nonce}`,
        `Ausgestellt: ${new Date().toISOString()}`,
        `Domain: ${window.location.host}`,
      ].join('\n');

      setStatus({ type: 'info', message: 'Bitte in deiner Solana Wallet signieren...' });

      const msgBytes = new TextEncoder().encode(messageText);
      const sigBytes = await solSignMessage(msgBytes);
      const signature = bs58.encode(sigBytes);

      setStatus({ type: 'info', message: 'Verifikation läuft...' });
      await siweApi.verifySolana(pubKeyStr, signature, messageText);

      const { authApi } = await import('../../lib/api');
      const { user: updatedUser } = await authApi.me();
      setUser(updatedUser);
      setScans(updatedUser.remaining_scans, updatedUser.total_scans_used, updatedUser.tier, updatedUser.expiry_date);

      setStatus({ type: 'success', message: `Solana Wallet ${pubKeyStr.slice(0, 6)}...${pubKeyStr.slice(-4)} verknüpft!` });
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.error || err?.message || 'Solana Verknüpfung fehlgeschlagen' });
    } finally {
      setLinking(false);
    }
  }, [publicKey, solSignMessage]);

  const walletIsLinked = !!user?.wallet;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[180] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-6"
      onClick={(e) => e.target === e.currentTarget && setWalletModal(false)}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="glass p-10 rounded-[2.5rem] max-w-lg w-full border-yellow-500/30"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="font-orbitron text-2xl font-black text-white uppercase tracking-tighter">
              Wallet Connect
            </h3>
            <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mt-1">
              SIWE · Secure Wallet Linking
            </p>
          </div>
          <button onClick={() => setWalletModal(false)} className="text-slate-500 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Linked wallet info */}
        {walletIsLinked && (
          <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-2xl px-5 py-4">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-green-400 text-xs font-mono font-bold uppercase tracking-widest">Wallet verknüpft</p>
              <p className="text-slate-400 text-[10px] font-mono mt-0.5">
                {user.wallet?.slice(0, 10)}...{user.wallet?.slice(-6)}
                {user.wallet_chain && <span className="ml-2 text-yellow-500 uppercase">({user.wallet_chain})</span>}
              </p>
            </div>
          </div>
        )}

        {/* Chain Tabs */}
        <div className="flex bg-white/5 rounded-2xl p-1 mb-8">
          {(['evm', 'solana'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setStatus(null); }}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all
                ${activeTab === tab ? 'bg-yellow-500 text-black' : 'text-slate-400 hover:text-white'}`}
            >
              {tab === 'evm' ? '⟠ EVM (ETH)' : '◎ Solana'}
            </button>
          ))}
        </div>

        {/* EVM Tab */}
        {activeTab === 'evm' && (
          <div className="space-y-4">
            <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-4">
              MetaMask · Rabby · Injected EVM Wallets
            </p>

            {!evmConnected ? (
              <div className="space-y-3">
                {connectors.map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => evmConnect({ connector })}
                    className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-500/30 rounded-2xl px-5 py-4 transition-all"
                  >
                    <div className="w-8 h-8 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-yellow-400" />
                    </div>
                    <span className="text-sm font-bold text-white">{connector.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-5 py-4 border border-white/10">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-white text-sm font-mono font-bold">
                      {evmAddress?.slice(0, 8)}...{evmAddress?.slice(-6)}
                    </p>
                    <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">
                      {chain?.name || 'Ethereum'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleEvmSiwe}
                  disabled={linking || walletIsLinked}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-slate-700 disabled:text-slate-500 text-black py-4 rounded-2xl font-orbitron font-black uppercase tracking-widest transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Link className="w-4 h-4" />
                  {walletIsLinked ? 'Wallet bereits verknüpft' : linking ? 'Verknüpfe...' : 'Mit Account verknüpfen (SIWE)'}
                </button>

                <button
                  onClick={() => evmDisconnect()}
                  className="w-full text-slate-500 hover:text-red-400 text-[11px] font-mono uppercase tracking-widest transition-colors flex items-center justify-center gap-2 py-2"
                >
                  <Unlink className="w-3 h-3" />
                  Wallet trennen
                </button>
              </div>
            )}
          </div>
        )}

        {/* Solana Tab */}
        {activeTab === 'solana' && (
          <div className="space-y-4">
            <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-4">
              Phantom · Backpack · Solflare
            </p>

            {!solConnected ? (
              <button
                onClick={() => setSolModalVisible(true)}
                className="w-full flex items-center justify-center gap-4 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 rounded-2xl px-5 py-5 transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <span className="text-purple-400 font-black text-sm">◎</span>
                </div>
                <span className="text-sm font-bold text-white">Solana Wallet auswählen</span>
              </button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-5 py-4 border border-white/10">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-white text-sm font-mono font-bold">
                      {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-6)}
                    </p>
                    <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">
                      {solWallet?.adapter.name || 'Solana'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSolanaSiwe}
                  disabled={linking || walletIsLinked}
                  className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-slate-700 disabled:text-slate-500 text-white py-4 rounded-2xl font-orbitron font-black uppercase tracking-widest transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Link className="w-4 h-4" />
                  {walletIsLinked ? 'Wallet bereits verknüpft' : linking ? 'Verknüpfe...' : 'Mit Account verknüpfen'}
                </button>

                <button
                  onClick={() => solDisconnect()}
                  className="w-full text-slate-500 hover:text-red-400 text-[11px] font-mono uppercase tracking-widest transition-colors flex items-center justify-center gap-2 py-2"
                >
                  <Unlink className="w-3 h-3" />
                  Wallet trennen
                </button>
              </div>
            )}
          </div>
        )}

        {/* Status */}
        {status && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 flex items-center gap-3 rounded-2xl px-5 py-4 text-sm font-mono
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

        {/* Security note */}
        <p className="text-slate-600 text-[9px] font-mono uppercase tracking-widest text-center mt-6">
          🔐 SIWE · EIP-4361 · Ed25519 · Kein Private Key wird übertragen
        </p>
      </motion.div>
    </motion.div>
  );
}
