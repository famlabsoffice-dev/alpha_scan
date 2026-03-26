/**
 * AlphaScan v4.0 PRO - Cloudflare Worker Backend
 * FamilyLaboratories | LIVE Arbitrage Intelligence
 *
 * Features:
 * - JWT Auth mit httpOnly Cookies (24h Expiry)
 * - SIWE (Sign-In With Ethereum) Wallet-Verknüpfung
 * - Cloudflare D1 SQLite Datenbank
 * - Tiered Payment System (Free → Yearly)
 * - Chainlink ETH/USD Preisorakel
 * - Persistente Scan-Zähler pro User/Wallet
 * - Rate Limiting via KV
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { SiweMessage } from 'siwe';
import bcrypt from 'bcryptjs';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  AUTH_PASSWORD: string;
  ALCHEMY_API_KEY: string;
  RECEIVER_ADDRESS_ETH: string;
  RECEIVER_ADDRESS_SOL: string;
}

interface User {
  id: number;
  username: string;
  pass_hash: string;
  wallet_address: string | null;
  wallet_chain: string | null;
  tier_name: string;
  remaining_scans: number;
  total_scans_used: number;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

interface JWTPayload {
  userId: number;
  username: string;
  wallet?: string;
  tier?: string;
  exp: number;
  iat: number;
}

// ─── Tier Definitions ─────────────────────────────────────────────────────────

export const TIERS = {
  free:          { name: 'Free',          price_usd: 0,    scans: 5,     period_days: null, label: 'Einmalig' },
  daily:         { name: 'Daily',         price_usd: 5,    scans: 5,     period_days: 1,    label: '24 Stunden' },
  weekly:        { name: 'Weekly',        price_usd: 10,   scans: 15,    period_days: 7,    label: '1 Woche' },
  weekly_pro:    { name: 'Weekly Pro',    price_usd: 25,   scans: 50,    period_days: 7,    label: '1 Woche' },
  monthly:       { name: 'Monthly',       price_usd: 75,   scans: 125,   period_days: 30,   label: '1 Monat' },
  monthly_pro:   { name: 'Monthly Pro',   price_usd: 100,  scans: 200,   period_days: 30,   label: '1 Monat' },
  monthly_ultra: { name: 'Monthly Ultra', price_usd: 200,  scans: 500,   period_days: 30,   label: '1 Monat' },
  half_year:     { name: 'Half-Year',     price_usd: 1000, scans: 4500,  period_days: 182,  label: '6 Monate' },
  yearly:        { name: 'Yearly',        price_usd: 2000, scans: 15000, period_days: 365,  label: '1 Jahr' },
};

// ─── Chainlink ETH/USD Price Feed ─────────────────────────────────────────────

async function getEthUsdPrice(): Promise<number> {
  // Chainlink ETH/USD on Ethereum Mainnet
  // Contract: 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
  const CHAINLINK_ETH_USD = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
  const ABI_LATEST_ROUND = '0xfeaf968c'; // latestRoundData() selector

  try {
    // Use public Ethereum RPC (Cloudflare eth gateway)
    const rpcUrl = 'https://cloudflare-eth.com';
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: CHAINLINK_ETH_USD, data: ABI_LATEST_ROUND }, 'latest'],
        id: 1,
      }),
    });
    const data = await response.json() as { result: string };
    if (data.result && data.result !== '0x') {
      // Decode: roundId(uint80), answer(int256), startedAt(uint256), updatedAt(uint256), answeredInRound(uint80)
      // answer is at offset 32 bytes (after roundId padding), 8 decimals
      const hex = data.result.slice(2);
      const answerHex = hex.slice(64, 128); // second 32-byte slot
      const answer = BigInt('0x' + answerHex);
      const price = Number(answer) / 1e8;
      if (price > 100 && price < 100000) return price;
    }
  } catch (e) {
    console.error('Chainlink fetch error:', e);
  }
  // Fallback: Kraken API
  try {
    const r = await fetch('https://api.kraken.com/0/public/Ticker?pair=ETHUSD');
    const d = await r.json() as { result: Record<string, { c: string[] }> };
    const k = Object.keys(d.result)[0];
    return parseFloat(d.result[k].c[0]);
  } catch {
    return 3000; // Static fallback
  }
}

async function getSolUsdPrice(): Promise<number> {
  try {
    const r = await fetch('https://api.kraken.com/0/public/Ticker?pair=SOLUSD');
    const d = await r.json() as { result: Record<string, { c: string[] }> };
    const k = Object.keys(d.result)[0];
    return parseFloat(d.result[k].c[0]);
  } catch {
    return 150;
  }
}

// USD → ETH conversion via Chainlink
async function usdToEth(usd: number): Promise<string> {
  const ethPrice = await getEthUsdPrice();
  const eth = usd / ethPrice;
  return eth.toFixed(6);
}

async function usdToSol(usd: number): Promise<string> {
  const solPrice = await getSolUsdPrice();
  const sol = usd / solPrice;
  return sol.toFixed(4);
}

// ─── JWT Helpers ──────────────────────────────────────────────────────────────

async function createJWT(payload: Omit<JWTPayload, 'exp' | 'iat'>, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ ...payload, iat: now, exp: now + 86400 }, secret); // 24h
}

async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const payload = await verify(token, secret) as JWTPayload;
    return payload;
  } catch {
    return null;
  }
}

// ─── SIWE Helpers ─────────────────────────────────────────────────────────────

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  array.forEach(b => result += chars[b % chars.length]);
  return result;
}

// ─── Hono App ─────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('*', cors({
  origin: ['https://famlabsoffice-dev.github.io', 'https://alphascan.famlabs.workers.dev', 'http://localhost:5173', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-FamLabs-Auth'],
  credentials: true,
}));

// ─── Auth Middleware ───────────────────────────────────────────────────────────

async function requireAuth(c: any, next: any) {
  const token = getCookie(c, 'session') || c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ error: 'UNAUTHORIZED', message: 'Kein Session-Token' }, 401);

  // Check blacklist
  const blacklisted = await c.env.KV.get(`blacklist:${token}`);
  if (blacklisted) return c.json({ error: 'SESSION_INVALIDATED' }, 401);

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: 'INVALID_TOKEN' }, 401);

  c.set('user', payload);
  await next();
}

// ─── Routes: Auth ─────────────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (c) => {
  const { username, password } = await c.req.json();
  if (!username || !password) return c.json({ error: 'Username und Passwort erforderlich' }, 400);
  if (username.length < 3 || password.length < 8) return c.json({ error: 'Username min. 3, Passwort min. 8 Zeichen' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existing) return c.json({ error: 'Username bereits vergeben' }, 409);

  const pass_hash = await bcrypt.hash(password, 12);
  const result = await c.env.DB.prepare(
    'INSERT INTO users (username, pass_hash, tier_name, remaining_scans) VALUES (?, ?, ?, ?) RETURNING id'
  ).bind(username, pass_hash, 'free', 5).first<{ id: number }>();

  const token = await createJWT({ userId: result!.id, username, tier: 'free' }, c.env.JWT_SECRET);
  setCookie(c, 'session', token, { httpOnly: true, secure: true, sameSite: 'Strict', maxAge: 86400, path: '/' });

  return c.json({ success: true, user: { id: result!.id, username, tier: 'free', remaining_scans: 5 } });
});

// POST /api/auth/login
app.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json();
  if (!username || !password) return c.json({ error: 'Credentials erforderlich' }, 400);

  // Rate limit: max 5 attempts per 15 min
  const rateLimitKey = `ratelimit:login:${username}`;
  const attempts = parseInt(await c.env.KV.get(rateLimitKey) || '0');
  if (attempts >= 5) return c.json({ error: 'Zu viele Login-Versuche. Bitte 15 Minuten warten.' }, 429);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<User>();
  if (!user) {
    await c.env.KV.put(rateLimitKey, String(attempts + 1), { expirationTtl: 900 });
    return c.json({ error: 'Ungültige Zugangsdaten' }, 401);
  }

  const valid = await bcrypt.compare(password, user.pass_hash);
  if (!valid) {
    await c.env.KV.put(rateLimitKey, String(attempts + 1), { expirationTtl: 900 });
    return c.json({ error: 'Ungültige Zugangsdaten' }, 401);
  }

  // Reset rate limit on success
  await c.env.KV.delete(rateLimitKey);

  // Check tier expiry and reset if needed
  await checkAndResetTier(c.env.DB, user);

  const token = await createJWT({ userId: user.id, username: user.username, wallet: user.wallet_address || undefined, tier: user.tier_name }, c.env.JWT_SECRET);
  setCookie(c, 'session', token, { httpOnly: true, secure: true, sameSite: 'Strict', maxAge: 86400, path: '/' });

  return c.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      wallet: user.wallet_address,
      wallet_chain: user.wallet_chain,
      tier: user.tier_name,
      remaining_scans: user.remaining_scans,
      expiry_date: user.expiry_date,
    }
  });
});

// POST /api/auth/logout
app.post('/api/auth/logout', requireAuth, async (c) => {
  const token = getCookie(c, 'session') || c.req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    // Blacklist token until expiry
    await c.env.KV.put(`blacklist:${token}`, '1', { expirationTtl: 86400 });
  }
  deleteCookie(c, 'session', { path: '/' });
  return c.json({ success: true });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, async (c) => {
  const jwtUser = c.get('user') as JWTPayload;
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(jwtUser.userId).first<User>();
  if (!user) return c.json({ error: 'User nicht gefunden' }, 404);

  await checkAndResetTier(c.env.DB, user);
  const fresh = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(jwtUser.userId).first<User>();

  return c.json({
    user: {
      id: fresh!.id,
      username: fresh!.username,
      wallet: fresh!.wallet_address,
      wallet_chain: fresh!.wallet_chain,
      tier: fresh!.tier_name,
      remaining_scans: fresh!.remaining_scans,
      total_scans_used: fresh!.total_scans_used,
      expiry_date: fresh!.expiry_date,
    }
  });
});

// ─── Routes: SIWE (Sign-In With Ethereum) ─────────────────────────────────────

// GET /api/siwe/nonce
app.get('/api/siwe/nonce', requireAuth, async (c) => {
  const jwtUser = c.get('user') as JWTPayload;
  const nonce = generateNonce();
  // Store nonce in KV with 5 min TTL
  await c.env.KV.put(`siwe_nonce:${jwtUser.userId}`, nonce, { expirationTtl: 300 });
  return c.json({ nonce });
});

// POST /api/siwe/verify
app.post('/api/siwe/verify', requireAuth, async (c) => {
  const jwtUser = c.get('user') as JWTPayload;
  const { message, signature, chain } = await c.req.json();

  const storedNonce = await c.env.KV.get(`siwe_nonce:${jwtUser.userId}`);
  if (!storedNonce) return c.json({ error: 'Nonce abgelaufen oder ungültig' }, 400);

  try {
    const siweMsg = new SiweMessage(message);
    const result = await siweMsg.verify({ signature, nonce: storedNonce });

    if (!result.success) return c.json({ error: 'SIWE Verifikation fehlgeschlagen' }, 401);

    const walletAddress = siweMsg.address;
    const walletChain = chain || 'evm';

    // Check if wallet already linked to another user
    const existingWallet = await c.env.DB.prepare(
      'SELECT id FROM users WHERE wallet_address = ? AND id != ?'
    ).bind(walletAddress, jwtUser.userId).first();
    if (existingWallet) return c.json({ error: 'Wallet bereits mit anderem Account verknüpft' }, 409);

    // Update user with wallet
    await c.env.DB.prepare(
      'UPDATE users SET wallet_address = ?, wallet_chain = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(walletAddress, walletChain, jwtUser.userId).run();

    // Delete used nonce
    await c.env.KV.delete(`siwe_nonce:${jwtUser.userId}`);

    // Refresh JWT with wallet info
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(jwtUser.userId).first<User>();
    const newToken = await createJWT({ userId: user!.id, username: user!.username, wallet: walletAddress, tier: user!.tier_name }, c.env.JWT_SECRET);

    // Blacklist old token
    const oldToken = getCookie(c, 'session') || c.req.header('Authorization')?.replace('Bearer ', '');
    if (oldToken) await c.env.KV.put(`blacklist:${oldToken}`, '1', { expirationTtl: 86400 });

    setCookie(c, 'session', newToken, { httpOnly: true, secure: true, sameSite: 'Strict', maxAge: 86400, path: '/' });

    return c.json({ success: true, wallet: walletAddress, chain: walletChain });
  } catch (e) {
    return c.json({ error: 'Verifikation fehlgeschlagen: ' + String(e) }, 400);
  }
});

// POST /api/siwe/verify-solana (Solana Wallet via Phantom/Backpack/Solflare)
app.post('/api/siwe/verify-solana', requireAuth, async (c) => {
  const jwtUser = c.get('user') as JWTPayload;
  const { publicKey, signature, message } = await c.req.json();

  const storedNonce = await c.env.KV.get(`siwe_nonce:${jwtUser.userId}`);
  if (!storedNonce) return c.json({ error: 'Nonce abgelaufen' }, 400);

  if (!message.includes(storedNonce)) return c.json({ error: 'Nonce mismatch' }, 400);

  // Verify Solana signature using nacl (Ed25519)
  try {
    const { default: nacl } = await import('tweetnacl');
    const { default: bs58 } = await import('bs58');

    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signature);
    const pubKeyBytes = bs58.decode(publicKey);

    const valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
    if (!valid) return c.json({ error: 'Ungültige Solana Signatur' }, 401);

    // Check duplicate wallet
    const existingWallet = await c.env.DB.prepare(
      'SELECT id FROM users WHERE wallet_address = ? AND id != ?'
    ).bind(publicKey, jwtUser.userId).first();
    if (existingWallet) return c.json({ error: 'Wallet bereits verknüpft' }, 409);

    await c.env.DB.prepare(
      'UPDATE users SET wallet_address = ?, wallet_chain = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(publicKey, 'solana', jwtUser.userId).run();

    await c.env.KV.delete(`siwe_nonce:${jwtUser.userId}`);

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(jwtUser.userId).first<User>();
    const newToken = await createJWT({ userId: user!.id, username: user!.username, wallet: publicKey, tier: user!.tier_name }, c.env.JWT_SECRET);

    const oldToken = getCookie(c, 'session') || c.req.header('Authorization')?.replace('Bearer ', '');
    if (oldToken) await c.env.KV.put(`blacklist:${oldToken}`, '1', { expirationTtl: 86400 });

    setCookie(c, 'session', newToken, { httpOnly: true, secure: true, sameSite: 'Strict', maxAge: 86400, path: '/' });

    return c.json({ success: true, wallet: publicKey, chain: 'solana' });
  } catch (e) {
    return c.json({ error: 'Solana Verifikation fehlgeschlagen: ' + String(e) }, 400);
  }
});

// ─── Routes: Scans ────────────────────────────────────────────────────────────

// POST /api/scans/execute
app.post('/api/scans/execute', requireAuth, async (c) => {
  const jwtUser = c.get('user') as JWTPayload;

  // Atomic scan deduction
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(jwtUser.userId).first<User>();
  if (!user) return c.json({ error: 'User nicht gefunden' }, 404);

  await checkAndResetTier(c.env.DB, user);
  const freshUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(jwtUser.userId).first<User>();

  if (freshUser!.remaining_scans <= 0) {
    return c.json({
      error: 'SCAN_LIMIT_REACHED',
      message: 'Scan-Limit erreicht. Bitte Tier upgraden.',
      remaining_scans: 0,
      tier: freshUser!.tier_name,
    }, 402);
  }

  // Deduct scan atomically
  await c.env.DB.prepare(
    'UPDATE users SET remaining_scans = remaining_scans - 1, total_scans_used = total_scans_used + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND remaining_scans > 0'
  ).bind(jwtUser.userId).run();

  // Log scan
  await c.env.DB.prepare(
    'INSERT INTO scan_logs (user_id, wallet_address, tier_name, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
  ).bind(jwtUser.userId, user.wallet_address, user.tier_name).run();

  const updatedUser = await c.env.DB.prepare('SELECT remaining_scans, total_scans_used FROM users WHERE id = ?').bind(jwtUser.userId).first<{ remaining_scans: number; total_scans_used: number }>();

  return c.json({
    success: true,
    remaining_scans: updatedUser!.remaining_scans,
    total_scans_used: updatedUser!.total_scans_used,
    tier: freshUser!.tier_name,
  });
});

// GET /api/scans/status
app.get('/api/scans/status', requireAuth, async (c) => {
  const jwtUser = c.get('user') as JWTPayload;
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(jwtUser.userId).first<User>();
  if (!user) return c.json({ error: 'User nicht gefunden' }, 404);

  await checkAndResetTier(c.env.DB, user);
  const fresh = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(jwtUser.userId).first<User>();

  return c.json({
    remaining_scans: fresh!.remaining_scans,
    total_scans_used: fresh!.total_scans_used,
    tier: fresh!.tier_name,
    expiry_date: fresh!.expiry_date,
  });
});

// ─── Routes: Payment ──────────────────────────────────────────────────────────

// GET /api/payment/tiers
app.get('/api/payment/tiers', async (c) => {
  const ethPrice = await getEthUsdPrice();
  const solPrice = await getSolUsdPrice();

  const tiersWithPrices = await Promise.all(
    Object.entries(TIERS).map(async ([key, tier]) => ({
      key,
      ...tier,
      price_eth: tier.price_usd > 0 ? (tier.price_usd / ethPrice).toFixed(6) : '0',
      price_sol: tier.price_usd > 0 ? (tier.price_usd / solPrice).toFixed(4) : '0',
      price_usdc: tier.price_usd.toFixed(2),
    }))
  );

  return c.json({
    tiers: tiersWithPrices,
    eth_usd: ethPrice.toFixed(2),
    sol_usd: solPrice.toFixed(2),
    receiver_eth: c.env.RECEIVER_ADDRESS_ETH,
    receiver_sol: c.env.RECEIVER_ADDRESS_SOL,
    updated_at: new Date().toISOString(),
  });
});

// POST /api/payment/verify-evm
app.post('/api/payment/verify-evm', requireAuth, async (c) => {
  const jwtUser = c.get('user') as JWTPayload;
  const { txHash, tierKey, walletAddress } = await c.req.json();

  if (!txHash || !tierKey || !TIERS[tierKey as keyof typeof TIERS]) {
    return c.json({ error: 'Ungültige Parameter' }, 400);
  }

  // Double-check: JWT + Wallet must match
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(jwtUser.userId).first<User>();
  if (user?.wallet_address && walletAddress && user.wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
    return c.json({ error: 'Wallet-Adresse stimmt nicht mit Account überein' }, 403);
  }

  // Check if TX already processed
  const existingTx = await c.env.DB.prepare('SELECT id FROM payment_logs WHERE tx_hash = ?').bind(txHash).first();
  if (existingTx) return c.json({ error: 'Transaktion bereits verarbeitet' }, 409);

  // Verify TX on-chain via Alchemy/public RPC
  const tier = TIERS[tierKey as keyof typeof TIERS];
  const ethPrice = await getEthUsdPrice();
  const expectedEth = tier.price_usd / ethPrice;
  const minEth = expectedEth * 0.95; // 5% tolerance

  try {
    const rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${c.env.ALCHEMY_API_KEY}`;
    const txResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionByHash',
        params: [txHash],
        id: 1,
      }),
    });
    const txData = await txResponse.json() as { result: { to: string; value: string; from: string } | null };

    if (!txData.result) return c.json({ error: 'Transaktion nicht gefunden' }, 404);

    const tx = txData.result;
    const toAddress = tx.to?.toLowerCase();
    const receiverAddress = c.env.RECEIVER_ADDRESS_ETH?.toLowerCase();
    const valueEth = parseInt(tx.value, 16) / 1e18;

    if (toAddress !== receiverAddress) return c.json({ error: 'Falsche Empfängeradresse' }, 400);
    if (valueEth < minEth) return c.json({ error: `Zu wenig ETH gesendet. Erwartet: ${expectedEth.toFixed(6)} ETH` }, 400);

    // Activate tier
    await activateTier(c.env.DB, jwtUser.userId, tierKey, txHash, 'evm', walletAddress, tier.price_usd);

    // Refresh JWT
    const updatedUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(jwtUser.userId).first<User>();
    const newToken = await createJWT({ userId: updatedUser!.id, username: updatedUser!.username, wallet: updatedUser!.wallet_address || undefined, tier: tierKey }, c.env.JWT_SECRET);
    const oldToken = getCookie(c, 'session') || c.req.header('Authorization')?.replace('Bearer ', '');
    if (oldToken) await c.env.KV.put(`blacklist:${oldToken}`, '1', { expirationTtl: 86400 });
    setCookie(c, 'session', newToken, { httpOnly: true, secure: true, sameSite: 'Strict', maxAge: 86400, path: '/' });

    return c.json({
      success: true,
      tier: tierKey,
      tier_name: tier.name,
      remaining_scans: updatedUser!.remaining_scans,
      expiry_date: updatedUser!.expiry_date,
    });
  } catch (e) {
    return c.json({ error: 'TX-Verifikation fehlgeschlagen: ' + String(e) }, 500);
  }
});

// POST /api/payment/verify-solana
app.post('/api/payment/verify-solana', requireAuth, async (c) => {
  const jwtUser = c.get('user') as JWTPayload;
  const { txSignature, tierKey, walletAddress } = await c.req.json();

  if (!txSignature || !tierKey || !TIERS[tierKey as keyof typeof TIERS]) {
    return c.json({ error: 'Ungültige Parameter' }, 400);
  }

  const existingTx = await c.env.DB.prepare('SELECT id FROM payment_logs WHERE tx_hash = ?').bind(txSignature).first();
  if (existingTx) return c.json({ error: 'Transaktion bereits verarbeitet' }, 409);

  const tier = TIERS[tierKey as keyof typeof TIERS];
  const solPrice = await getSolUsdPrice();
  const expectedSol = tier.price_usd / solPrice;
  const minSol = expectedSol * 0.95;

  try {
    // Verify on Solana mainnet via public RPC
    const solRpc = 'https://api.mainnet-beta.solana.com';
    const txResponse = await fetch(solRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [txSignature, { encoding: 'json', maxSupportedTransactionVersion: 0 }],
      }),
    });
    const txData = await txResponse.json() as { result: any };

    if (!txData.result) return c.json({ error: 'Solana TX nicht gefunden' }, 404);

    // Check receiver and amount in post/pre balances
    const accountKeys = txData.result.transaction?.message?.accountKeys || [];
    const receiverIdx = accountKeys.findIndex((k: string) => k === c.env.RECEIVER_ADDRESS_SOL);
    if (receiverIdx === -1) return c.json({ error: 'Falsche Empfängeradresse' }, 400);

    const preBalance = txData.result.meta?.preBalances?.[receiverIdx] || 0;
    const postBalance = txData.result.meta?.postBalances?.[receiverIdx] || 0;
    const receivedSol = (postBalance - preBalance) / 1e9;

    if (receivedSol < minSol) return c.json({ error: `Zu wenig SOL. Erwartet: ${expectedSol.toFixed(4)} SOL` }, 400);

    await activateTier(c.env.DB, jwtUser.userId, tierKey, txSignature, 'solana', walletAddress, tier.price_usd);

    const updatedUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(jwtUser.userId).first<User>();
    const newToken = await createJWT({ userId: updatedUser!.id, username: updatedUser!.username, wallet: updatedUser!.wallet_address || undefined, tier: tierKey }, c.env.JWT_SECRET);
    const oldToken = getCookie(c, 'session') || c.req.header('Authorization')?.replace('Bearer ', '');
    if (oldToken) await c.env.KV.put(`blacklist:${oldToken}`, '1', { expirationTtl: 86400 });
    setCookie(c, 'session', newToken, { httpOnly: true, secure: true, sameSite: 'Strict', maxAge: 86400, path: '/' });

    return c.json({
      success: true,
      tier: tierKey,
      tier_name: tier.name,
      remaining_scans: updatedUser!.remaining_scans,
      expiry_date: updatedUser!.expiry_date,
    });
  } catch (e) {
    return c.json({ error: 'Solana TX-Verifikation fehlgeschlagen: ' + String(e) }, 500);
  }
});

// ─── Routes: Arbitrage Data (Original Worker Logic) ───────────────────────────

// GET /api/scan/data
app.get('/api/scan/data', requireAuth, async (c) => {
  const [krakenSol, krakenBtc, krakenEth, polymarketClob, manifold] = await Promise.all([
    safeFetch('https://api.kraken.com/0/public/Ticker?pair=SOLUSD'),
    safeFetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSD'),
    safeFetch('https://api.kraken.com/0/public/Ticker?pair=ETHUSD'),
    safeFetch('https://clob.polymarket.com/markets?active=true&closed=false&limit=200'),
    safeFetch('https://api.manifold.markets/v0/markets?limit=100'),
  ]);

  const crypto: Record<string, number> = {};
  if (krakenSol?.result) { const k = Object.keys(krakenSol.result)[0]; crypto.SOL = parseFloat(krakenSol.result[k].c[0]); }
  if (krakenBtc?.result) { const k = Object.keys(krakenBtc.result)[0]; crypto.BTC = parseFloat(krakenBtc.result[k].c[0]); }
  if (krakenEth?.result) { const k = Object.keys(krakenEth.result)[0]; crypto.ETH = parseFloat(krakenEth.result[k].c[0]); }

  // Chainlink ETH/USD
  crypto.ETH_CHAINLINK = await getEthUsdPrice();

  return c.json({ crypto, markets_count: (polymarketClob as any[])?.length || 0, status: 'SUCCESS' });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function activateTier(db: D1Database, userId: number, tierKey: string, txHash: string, chain: string, walletAddress: string, paidUsd: number) {
  const tier = TIERS[tierKey as keyof typeof TIERS];
  const now = new Date();
  let expiryDate: string | null = null;

  if (tier.period_days) {
    const expiry = new Date(now.getTime() + tier.period_days * 86400000);
    expiryDate = expiry.toISOString();
  }

  await db.prepare(
    'UPDATE users SET tier_name = ?, remaining_scans = remaining_scans + ?, expiry_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(tierKey, tier.scans, expiryDate, userId).run();

  await db.prepare(
    'INSERT INTO payment_logs (user_id, tier_key, tier_name, tx_hash, chain, wallet_address, amount_usd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
  ).bind(userId, tierKey, tier.name, txHash, chain, walletAddress, paidUsd).run();
}

async function checkAndResetTier(db: D1Database, user: User) {
  if (!user.expiry_date) return;
  const now = new Date();
  const expiry = new Date(user.expiry_date);
  if (now > expiry && user.tier_name !== 'free') {
    await db.prepare(
      'UPDATE users SET tier_name = ?, remaining_scans = 0, expiry_date = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind('free', user.id).run();
  }
}

async function safeFetch(url: string, timeout = 6000): Promise<any> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(id);
    return null;
  }
}

// ─── Cron: Reset Expired Tiers ────────────────────────────────────────────────

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Run every hour: reset expired tiers
    const expiredUsers = await env.DB.prepare(
      'SELECT id, tier_name FROM users WHERE expiry_date IS NOT NULL AND expiry_date < CURRENT_TIMESTAMP AND tier_name != ?'
    ).bind('free').all<{ id: number; tier_name: string }>();

    for (const user of expiredUsers.results) {
      await env.DB.prepare(
        'UPDATE users SET tier_name = ?, remaining_scans = 0, expiry_date = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind('free', user.id).run();
    }

    console.log(`Cron: ${expiredUsers.results.length} abgelaufene Tiers zurückgesetzt`);
  },
};
