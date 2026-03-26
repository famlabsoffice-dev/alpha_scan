CREATE TABLE IF NOT EXISTS nonces (
  address TEXT NOT NULL,
  nonce TEXT NOT NULL,
  used INTEGER DEFAULT 0, -- 0 for false, 1 for true
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (address, nonce)
);

CREATE INDEX IF NOT EXISTS idx_nonces_address ON nonces (address);
CREATE INDEX IF NOT EXISTS idx_nonces_used ON nonces (used);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  pass_hash TEXT,
  wallet_address TEXT UNIQUE,
  wallet_chain TEXT,
  tier_name TEXT NOT NULL DEFAULT 'free',
  remaining_scans INTEGER NOT NULL DEFAULT 0,
  total_scans_used INTEGER NOT NULL DEFAULT 0,
  expiry_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users (wallet_address);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  jwt_token TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
