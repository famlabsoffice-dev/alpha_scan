/**
 * AlphaScan v4.0 PRO - Global State (Zustand)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from './api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'alphascan-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

interface ScanState {
  remainingScans: number;
  totalScansUsed: number;
  tier: string;
  expiryDate: string | null;
  isScanning: boolean;
  lastScanData: any | null;
  setScans: (remaining: number, total: number, tier: string, expiry: string | null) => void;
  setScanning: (scanning: boolean) => void;
  setScanData: (data: any) => void;
  decrementScans: () => void;
}

export const useScanStore = create<ScanState>()((set) => ({
  remainingScans: 0,
  totalScansUsed: 0,
  tier: 'free',
  expiryDate: null,
  isScanning: false,
  lastScanData: null,
  setScans: (remainingScans, totalScansUsed, tier, expiryDate) =>
    set({ remainingScans, totalScansUsed, tier, expiryDate }),
  setScanning: (isScanning) => set({ isScanning }),
  setScanData: (lastScanData) => set({ lastScanData }),
  decrementScans: () => set((s) => ({ remainingScans: Math.max(0, s.remainingScans - 1) })),
}));

interface UIState {
  showPaymentModal: boolean;
  showAuthModal: boolean;
  authMode: 'login' | 'register';
  showWalletModal: boolean;
  setPaymentModal: (show: boolean) => void;
  setAuthModal: (show: boolean, mode?: 'login' | 'register') => void;
  setWalletModal: (show: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  showPaymentModal: false,
  showAuthModal: false,
  authMode: 'login',
  showWalletModal: false,
  setPaymentModal: (showPaymentModal) => set({ showPaymentModal }),
  setAuthModal: (showAuthModal, authMode = 'login') => set({ showAuthModal, authMode }),
  setWalletModal: (showWalletModal) => set({ showWalletModal }),
}));
