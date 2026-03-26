# AlphaScan v2.1 – Deployment Guide

## Übersicht

AlphaScan v2.1 ist ein Cross-DEX Arbitrage Scanner mit Cloudflare Workers Backend und HTML5 Frontend. Das System erkennt Arbitrage-Gelegenheiten zwischen verschiedenen DEXs mit Fokus auf Monaco/Hxro auf Solana mit SPL Outcome Tokens.

**Live-URL:** https://famlabsoffice-dev.github.io/alpha_scan/

---

## Was ist neu in v2.1

| Feature | v2.0 | v2.1 |
|---|---|---|
| SOL-Preis | Binance (geo-blocked) | **Kraken + Jupiter On-Chain** |
| BTC-Preis | Binance (geo-blocked) | **Kraken + CoinGecko Fallback** |
| ETH-Preis | – | **Kraken** |
| Arbitrage-Paare | SOL Kraken/Jupiter | **Monaco/Hxro (PRIMARY) + 2 weitere** |
| Profit-Kalkulation | Einfach | **5€ / 10€ / 25€ mit ROI** |
| YES/NO Buttons | Nur YES | **YES + NO mit Live-Preisen** |
| Ticker | Statisch | **Live-Preise im Ticker** |
| GitHub Actions | Fehlt | **Vollständiger CI/CD Workflow** |
| Git-Tag Snapshot | Fehlt | **v2.1.0 gesetzt** |

---

## Architektur

### Backend: Cloudflare Worker (`index.js`)

```
ARBITRAGE_PAIRS (Priority):
  1. Monaco ↔ Hxro        (Solana, SPL_OUTCOME)  ← PRIMARY
  2. Polymarket ↔ UniswapV3 (Polygon, ERC1155_CTF)
  3. JupiterPM ↔ PolymarketBridge (Solana, WPM_SHARE)

Live-Preis-APIs (alle kostenlos, kein API-Key):
  - Kraken Public API:  api.kraken.com/0/public/Ticker
  - Jupiter Quote API:  quote-api.jup.ag/v6/quote
  - Polymarket CLOB:    clob.polymarket.com/markets
  - CoinGecko Demo:     api.coingecko.com/api/v3/simple/price (Fallback)

Profit-Formel:
  shares     = amount / buyPrice
  gross      = shares * sellPrice
  totalFees  = amount * (feesBuy + feesSell)
  net profit = gross - amount - totalFees
  ROI        = (net / amount) * 100
```

### Frontend: GitHub Pages (`index.html`)

- **Passwort:** `TGMFAM2026`
- **Auto-Refresh:** alle 30 Sekunden
- **Sprachen:** DE, EN, PT, ZH
- **Crypto-Preise:** SOL (Kraken + Jupiter), BTC, ETH im Header
- **Arbitrage-Karten:** Profit-Tiers 5€/10€/25€ mit ROI
- **Market Cards:** YES/NO Buttons mit Live-Preisen

---

## Schnellstart

### 1. Cloudflare Worker deployen

```bash
# Wrangler installieren
npm install -g wrangler

# Einloggen
wrangler login

# Deployen
wrangler deploy

# Optional: Auth-Passwort als Secret setzen
wrangler secret put AUTH_PASSWORD
# → Eingabe: TGMFAM2026
```

### 2. GitHub Pages aktivieren

1. Repository → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main**, Folder: **/ (root)**
4. Speichern → URL: `https://famlabsoffice-dev.github.io/alpha_scan/`

### 3. GitHub Actions Workflow aktivieren (CI/CD)

Der Workflow `.github/workflows/deploy.yml` ist bereit. Er benötigt zwei GitHub Secrets:

**Repository → Settings → Secrets and variables → Actions → New repository secret:**

| Secret Name | Wert |
|---|---|
| `CF_API_TOKEN` | Cloudflare API Token (Workers:Edit + Pages:Edit) |
| `CF_ACCOUNT_ID` | Cloudflare Account ID (Dashboard → rechte Seite) |

**Cloudflare API Token erstellen:**
1. https://dash.cloudflare.com/profile/api-tokens
2. → **Create Token** → **Edit Cloudflare Workers** Template
3. Zusätzlich: **Cloudflare Pages: Edit** hinzufügen
4. Token kopieren → als `CF_API_TOKEN` in GitHub Secrets eintragen

**Workflow-Datei manuell hinzufügen** (wegen GitHub App Permissions):

Da der GitHub App Token keine `workflows`-Berechtigung hat, muss die Datei manuell erstellt werden:

```bash
# Lokal im Repository:
mkdir -p .github/workflows
# Inhalt aus deploy.yml (unten) einfügen
git add .github/workflows/deploy.yml
git commit -m "ci: Add GitHub Actions workflow"
git push
```

**Workflow-Inhalt** (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to Cloudflare Workers and Pages

on:
  push:
    branches:
      - main
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy Alpha Scan
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Dependencies
        run: npm install -g wrangler

      - name: Deploy Cloudflare Worker
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
        run: |
          if [ -n "$CLOUDFLARE_API_TOKEN" ] && [ -n "$CLOUDFLARE_ACCOUNT_ID" ]; then
            wrangler deploy --name alphascan --main index.js --compatibility-date 2025-09-27
          else
            echo "Cloudflare credentials not found. Skipping Worker deployment."
          fi

      - name: Deploy Frontend to Cloudflare Pages
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
        run: |
          if [ -n "$CLOUDFLARE_API_TOKEN" ] && [ -n "$CLOUDFLARE_ACCOUNT_ID" ]; then
            mkdir -p dist
            cp index.html dist/
            wrangler pages deploy dist --project-name alpha-scan --branch main
          else
            echo "Cloudflare credentials not found. Skipping Pages deployment."
          fi
```

---

## API Endpoints

### Worker Endpoint

```
GET https://alphascan.famlabsoffice.workers.dev/?auth=TGMFAM2026
```

**Response-Format v2.1:**

```json
{
  "timestamp": "2026-03-25T12:00:00.000Z",
  "executionTime": 850,
  "version": "2.1",
  "totalMarkets": 45,
  "arbitragePairs": 3,
  "opportunitiesFound": 3,
  "opportunities": [
    {
      "pairId": "monaco-hxro-solana",
      "buyDex": "Monaco",
      "sellDex": "Hxro",
      "chain": "Solana",
      "token": "SPL_OUTCOME",
      "buyPrice": 48.20,
      "sellPrice": 50.10,
      "percentageDifference": 3.94,
      "profitMargin": 3.49,
      "profit5": 0.17,
      "profit10": 0.35,
      "profit25": 0.87,
      "roi5": 3.49,
      "roi10": 3.49,
      "roi25": 3.49,
      "priority": 1,
      "status": "PROFITABLE"
    }
  ],
  "markets": [...],
  "crypto": {
    "SOL_KRAKEN": 91.71,
    "SOL_JUPITER": 91.68,
    "BTC_KRAKEN": 70694.70,
    "ETH_KRAKEN": 3450.20,
    "SOL": 91.71,
    "BTC": 70694.70,
    "ETH": 3450.20
  },
  "status": "SUCCESS"
}
```

---

## Git-Tags (Snapshots)

| Tag | Beschreibung |
|---|---|
| `v1.0-backup` | Ursprüngliche Version (Rücksetzer-Sicherung) |
| `v2.1.0` | Aktueller Stand mit Live-Preisen und Arbitrage-Engine |

**Auf alten Stand zurücksetzen:**
```bash
git checkout v1.0-backup
```

---

## Monitoring

```bash
# Worker-Logs live anzeigen
wrangler tail

# Worker testen
curl -H "X-FamLabs-Auth: TGMFAM2026" \
  https://alphascan.famlabsoffice.workers.dev/
```

---

## Sicherheit

- **Authentifizierung:** Password Gate + localStorage
- **Worker Auth:** Header `X-FamLabs-Auth` oder Query `?auth=`
- **Empfehlung:** `wrangler secret put AUTH_PASSWORD` für Produktion
- **CORS:** Vollständig konfiguriert

---

**Version:** 2.1
**Last Updated:** 2026-03-25
**Primary Focus:** Monaco/Hxro on Solana with SPL Outcome Tokens
**Footer:** C•J•V•K | © 2026 FamilyLaboratories
