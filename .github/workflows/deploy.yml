# AlphaScan v4.0 PRO — Deployment Guide
**FamilyLaboratories | LIVE Arbitrage Intelligence**

---

## Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│                    AlphaScan v4.0 PRO                       │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React/Vite)          Backend (Cloudflare Worker) │
│  ├── Wallet Adapters            ├── Hono Framework          │
│  │   ├── Phantom (Solana)       ├── D1 SQLite Database      │
│  │   ├── Backpack (Solana)      ├── KV Namespace            │
│  │   ├── Solflare (Solana)      ├── JWT (httpOnly Cookies)  │
│  │   ├── MetaMask (EVM)         ├── SIWE Auth               │
│  │   └── Rabby (EVM)            ├── Chainlink Oracle        │
│  ├── SIWE Integration           ├── Tier Payment System     │
│  ├── Payment Flow               └── Cron: Tier Reset        │
│  └── Scan Counter (Live)                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Schritt 1: Cloudflare Account vorbereiten

### 1.1 D1 Datenbank erstellen
```bash
cd backend
npm install
npx wrangler login
npx wrangler d1 create alphascan-db
# → Kopiere die database_id in backend/wrangler.toml
```

### 1.2 KV Namespace erstellen
```bash
npx wrangler kv:namespace create alphascan-kv
# → Kopiere die id in backend/wrangler.toml
```

### 1.3 wrangler.toml aktualisieren
```toml
[[d1_databases]]
binding = "DB"
database_name = "alphascan-db"
database_id = "DEINE_D1_DATABASE_ID"  # ← Hier eintragen

[[kv_namespaces]]
binding = "KV"
id = "DEINE_KV_NAMESPACE_ID"  # ← Hier eintragen
```

---

## Schritt 2: Datenbank migrieren
```bash
cd backend
# Lokal testen:
npx wrangler d1 migrations apply alphascan-db --local

# Remote deployen:
npx wrangler d1 migrations apply alphascan-db --remote
```

---

## Schritt 3: Secrets setzen
```bash
cd backend

# JWT Secret (min. 32 Zeichen, zufällig generiert)
npx wrangler secret put JWT_SECRET
# → Eingabe: [sicherer zufälliger String, z.B. openssl rand -hex 32]

# Alchemy API Key (für EVM TX-Verifikation)
npx wrangler secret put ALCHEMY_API_KEY
# → Eingabe: [dein Alchemy API Key von https://alchemy.com]

# Empfänger-Adressen für Payments
npx wrangler secret put RECEIVER_ADDRESS_ETH
# → Eingabe: 0xDEINE_ETH_ADRESSE

npx wrangler secret put RECEIVER_ADDRESS_SOL
# → Eingabe: DeineSolanaPublicKey
```

---

## Schritt 4: Backend deployen
```bash
cd backend
npx wrangler deploy
# → Worker URL: https://alphascan-backend.DEIN_SUBDOMAIN.workers.dev
```

---

## Schritt 5: Frontend konfigurieren
```bash
# Im Hauptverzeichnis:
cp .env.example .env.local
# Bearbeite .env.local:
# VITE_API_URL=https://alphascan-backend.DEIN_SUBDOMAIN.workers.dev/api
# VITE_WORKER_URL=https://alphascan.famlabsoffice.workers.dev
```

---

## Schritt 6: Frontend deployen
```bash
# Im Hauptverzeichnis:
npm install
cp react-index.html index.html
npm run build

# Auf Cloudflare Pages deployen:
npx wrangler pages deploy dist --project-name alpha-scan
```

---

## Schritt 7: GitHub Actions (CI/CD)

### Secrets in GitHub Repository eintragen:
| Secret Name | Wert |
|---|---|
| `CF_API_TOKEN` | Cloudflare API Token (Workers:Edit + Pages:Edit) |
| `CF_ACCOUNT_ID` | Cloudflare Account ID |
| `VITE_API_URL` | Backend Worker URL + /api |
| `VITE_WORKER_URL` | Original Worker URL |

---

## API Endpoints

| Endpoint | Methode | Beschreibung |
|---|---|---|
| `/api/auth/register` | POST | Account erstellen |
| `/api/auth/login` | POST | Login → JWT Cookie |
| `/api/auth/logout` | POST | Logout → Cookie löschen |
| `/api/auth/me` | GET | Aktueller User |
| `/api/siwe/nonce` | GET | SIWE Nonce abrufen |
| `/api/siwe/verify` | POST | EVM Wallet verknüpfen |
| `/api/siwe/verify-solana` | POST | Solana Wallet verknüpfen |
| `/api/scans/execute` | POST | Scan ausführen (Zähler -1) |
| `/api/scans/status` | GET | Scan-Status abrufen |
| `/api/payment/tiers` | GET | Tier-Preise (Chainlink) |
| `/api/payment/verify-evm` | POST | EVM TX verifizieren |
| `/api/payment/verify-solana` | POST | Solana TX verifizieren |
| `/api/scan/data` | GET | Arbitrage-Daten |

---

## Tier-System

| Tier | Preis | Scans | Periode |
|---|---|---|---|
| Free | $0 | 5 | Einmalig |
| Daily | $5 | 5 | 24h |
| Weekly | $10 | 15 | 7 Tage |
| Weekly Pro | $25 | 50 | 7 Tage |
| Monthly | $75 | 125 | 30 Tage |
| Monthly Pro | $100 | 200 | 30 Tage |
| Monthly Ultra | $200 | 500 | 30 Tage |
| Half-Year | $1.000 | 4.500 | 182 Tage |
| Yearly | $2.000 | 15.000 | 365 Tage |

**Preise werden live via Chainlink ETH/USD Oracle berechnet.**

---

## Sicherheits-Architektur

### JWT + SIWE Double-Auth
```
1. Login (Passwort) → JWT (httpOnly Cookie, 24h)
2. Wallet Connect → SIWE Sign → Backend verify → JWT refresh
3. Scan/Payment → JWT check + Wallet verify
4. Logout → JWT Blacklist (KV) + Cookie löschen
```

### Schutz-Maßnahmen
- **httpOnly Cookies**: JWT nie im localStorage (XSS-Schutz)
- **SameSite=Strict**: CSRF-Schutz
- **SIWE (EIP-4361)**: Kryptographische Wallet-Verifikation
- **Nonce (KV, 5min TTL)**: Replay-Attack-Schutz
- **JWT Blacklist (KV)**: Server-side Invalidierung
- **Rate Limiting**: Max. 5 Login-Versuche / 15 min
- **TX Double-Check**: Backend verifiziert jede Zahlung on-chain
- **Atomic Scan Deduction**: DB-Transaktion verhindert Race Conditions

---

## Lokale Entwicklung

```bash
# Backend (Cloudflare Worker lokal):
cd backend
cp .dev.vars.example .dev.vars
# .dev.vars ausfüllen
npx wrangler dev

# Frontend:
cd ..
cp .env.example .env.local
# .env.local: VITE_API_URL=http://localhost:8787/api
npm install
npm run dev
```

---

**Version:** v4.0 PRO
**Last Updated:** 2026-03-25
**Company:** FamilyLaboratories
**Slogan:** "AlphaScan findet. Du tradest."
