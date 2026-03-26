-- AlphaScan v4.0 PRO - D1 Database Schema
-- FamilyLaboratories

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  wallet_address TEXT UNIQUE,
  wallet_chain TEXT DEFAULT NULL, -- 'evm' | 'solana'
  tier_name TEXT NOT NULL DEFAULT 'free',
  remaining_scans INTEGER NOT NULL DEFAULT 5,
  total_scans_used INTEGER NOT NULL DEFAULT 0,
  expiry_date TEXT DEFAULT NULL, -- ISO 8601
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Payment logs
CREATE TABLE IF NOT EXISTS payment_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  tier_key TEXT NOT NULL,
  tier_name TEXT NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  chain TEXT NOT NULL, -- 'evm' | 'solana'
  wallet_address TEXT,
  amount_usd REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scan logs
CREATE TABLE IF NOT EXISTS scan_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  wallet_address TEXT,
  tier_name TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_payment_logs_user ON payment_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_tx ON payment_logs(tx_hash);
CREATE INDEX IF NOT EXISTS idx_scan_logs_user ON scan_logs(user_id);
