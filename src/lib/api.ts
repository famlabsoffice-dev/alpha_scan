/**
 * AlphaScan v4.0 PRO - API Client
 * Alle API-Calls mit httpOnly Cookie-Auth
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface User {
  id: number;
  username: string;
  wallet: string | null;
  wallet_chain: 'evm' | 'solana' | null;
  tier: string;
  remaining_scans: number;
  total_scans_used: number;
  expiry_date: string | null;
}

export interface Tier {
  key: string;
  name: string;
  price_usd: number;
  price_eth: string;
  price_sol: string;
  price_usdc: string;
  scans: number;
  period_days: number | null;
  label: string;
}

export interface TiersResponse {
  tiers: Tier[];
  eth_usd: string;
  sol_usd: string;
  receiver_eth: string;
  receiver_sol: string;
  updated_at: string;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include', // httpOnly cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (username: string, password: string) =>
    apiFetch<{ success: boolean; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  login: (username: string, password: string) =>
    apiFetch<{ success: boolean; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    apiFetch<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  me: () =>
    apiFetch<{ user: User }>('/auth/me'),
};

// ─── SIWE ─────────────────────────────────────────────────────────────────────

export const siweApi = {
  getNonce: () =>
    apiFetch<{ nonce: string }>('/siwe/nonce'),

  verifyEvm: (message: string, signature: string, chain?: string) =>
    apiFetch<{ success: boolean; wallet: string; chain: string }>('/siwe/verify', {
      method: 'POST',
      body: JSON.stringify({ message, signature, chain }),
    }),

  verifySolana: (publicKey: string, signature: string, message: string) =>
    apiFetch<{ success: boolean; wallet: string; chain: string }>('/siwe/verify-solana', {
      method: 'POST',
      body: JSON.stringify({ publicKey, signature, message }),
    }),
};

// ─── Scans ────────────────────────────────────────────────────────────────────

export const scanApi = {
  execute: () =>
    apiFetch<{ success: boolean; remaining_scans: number; total_scans_used: number; tier: string }>('/scans/execute', {
      method: 'POST',
    }),

  status: () =>
    apiFetch<{ remaining_scans: number; total_scans_used: number; tier: string; expiry_date: string | null }>('/scans/status'),

  getData: () =>
    apiFetch<{ crypto: Record<string, number>; markets_count: number; status: string }>('/scan/data'),
};

// ─── Payment ──────────────────────────────────────────────────────────────────

export const paymentApi = {
  getTiers: () =>
    apiFetch<TiersResponse>('/payment/tiers'),

  verifyEvm: (txHash: string, tierKey: string, walletAddress: string) =>
    apiFetch<{ success: boolean; tier: string; tier_name: string; remaining_scans: number; expiry_date: string }>('/payment/verify-evm', {
      method: 'POST',
      body: JSON.stringify({ txHash, tierKey, walletAddress }),
    }),

  verifySolana: (txSignature: string, tierKey: string, walletAddress: string) =>
    apiFetch<{ success: boolean; tier: string; tier_name: string; remaining_scans: number; expiry_date: string }>('/payment/verify-solana', {
      method: 'POST',
      body: JSON.stringify({ txSignature, tierKey, walletAddress }),
    }),
};
