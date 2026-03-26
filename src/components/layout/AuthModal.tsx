/**
 * AlphaScan v4.0 PRO - Auth Modal
 * Login + Register mit JWT httpOnly Cookie
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Eye, EyeOff, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';

import { authApi } from '../../lib/api';
import { useAuthStore, useScanStore, useUIStore } from '../../lib/store';

export default function AuthModal() {
  const { setUser } = useAuthStore();
  const { setScans } = useScanStore();
  const { authMode, setAuthModal } = useUIStore();

  const [mode, setMode] = useState<'login' | 'register'>(authMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      let result;
      if (mode === 'login') {
        result = await authApi.login(username, password);
      } else {
        result = await authApi.register(username, password);
        setSuccess('Account erstellt! Du hast 5 kostenlose Scans.');
      }

      setUser(result.user);
      setScans(result.user.remaining_scans, result.user.total_scans_used, result.user.tier, result.user.expiry_date);

      setTimeout(() => setAuthModal(false), mode === 'register' ? 1500 : 300);
    } catch (err: any) {
      setError(err?.error || err?.message || 'Fehler beim Anmelden');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-6"
      onClick={(e) => e.target === e.currentTarget && setAuthModal(false)}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="glass p-10 rounded-[2.5rem] max-w-md w-full border-yellow-500/30"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-[9px] font-orbitron font-black tracking-[0.5em] text-yellow-500 uppercase block mb-1">
              FAMILYLABORATORIES
            </span>
            <h2 className="font-orbitron text-2xl font-black text-white uppercase tracking-tighter">
              {mode === 'login' ? 'Access Terminal' : 'Create Account'}
            </h2>
          </div>
          <button
            onClick={() => setAuthModal(false)}
            className="text-slate-500 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-white/5 rounded-2xl p-1 mb-8">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setSuccess(null); }}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all
                ${mode === m ? 'bg-yellow-500 text-black' : 'text-slate-400 hover:text-white'}`}
            >
              {m === 'login' ? 'Login' : 'Registrieren'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              minLength={3}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-500/50 transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort"
              required
              minLength={8}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-12 py-4 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-500/50 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs font-mono bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 text-green-400 text-xs font-mono bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-slate-700 disabled:text-slate-500 text-black py-4 rounded-2xl font-orbitron font-black uppercase tracking-widest transition-all text-sm"
          >
            {loading ? 'Bitte warten...' : mode === 'login' ? 'Authorize Access' : 'Account erstellen'}
          </button>
        </form>

        {/* Free scans hint */}
        {mode === 'register' && (
          <p className="text-center text-slate-500 text-[10px] font-mono uppercase tracking-widest mt-6">
            ✓ 5 kostenlose Scans inklusive
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
