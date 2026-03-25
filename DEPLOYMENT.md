# AlphaScan v2.0 - Cloudflare Workers Deployment Guide

## Übersicht

AlphaScan v2.0 ist ein Cross-DEX Arbitrage Scanner mit Cloudflare Workers Backend und HTML5 Frontend. Das System erkennt Arbitrage-Gelegenheiten zwischen verschiedenen DEXs mit Fokus auf Monaco/Hxro auf Solana mit SPL Outcome Tokens.

## Voraussetzungen

- Cloudflare Account
- Node.js und npm/pnpm installiert
- Wrangler CLI (`npm install -g wrangler`)
- GitHub Repository Access

## Schnellstart

### 1. Repository Klonen

```bash
git clone https://github.com/famlabsoffice-dev/alpha_scan.git
cd alpha_scan
```

### 2. Wrangler Konfigurieren

Die `wrangler.jsonc` ist bereits konfiguriert:

```json
{
  "name": "alphascan",
  "main": "index.js",
  "compatibility_date": "2025-09-27",
  "compatibility_flags": ["nodejs_compat"]
}
```

### 3. Worker Deployen

```bash
# Installation
npm install

# Development (lokal testen)
wrangler dev

# Production Deployment
wrangler deploy
```

### 4. GitHub Pages Konfigurieren

Die `index.html` wird automatisch über GitHub Pages bereitgestellt:

1. GitHub Repository Settings → Pages
2. Source: Deploy from a branch
3. Branch: main, Folder: / (root)

Die Website ist dann verfügbar unter: `https://famlabsoffice-dev.github.io/alpha_scan/`

## Architektur

### Backend (Cloudflare Worker)

**Datei:** `index.js`

- **Authentifizierung:** Header-basiert (`X-FamLabs-Auth: TGMFAM2026`)
- **Datenquellen:**
  - Polymarket (Polygon)
  - Manifold Markets (Ethereum)
  - Kalshi (Ethereum)
- **Arbitrage-Engine:** Erkennt Spreads zwischen DEXs
- **Priorisierte Paare:**
  1. Monaco ↔ Hxro (Solana, SPL_OUTCOME) - PRIMARY
  2. Polymarket ↔ UniswapV3 (Polygon, ERC1155_CTF)
  3. JupiterPM ↔ PolymarketBridge (Solana, WPM_SHARE)

### Frontend (HTML5)

**Datei:** `index.html`

- **UI Framework:** Tailwind CSS
- **Authentifizierung:** Password Gate (TGMFAM2026)
- **Multi-Language:** DE, EN, PT, ZH
- **Features:**
  - Echtzeit-Arbitrage-Anzeige
  - Marktdaten-Feed
  - Cross-DEX Opportunity Matrix
  - Live Profit Margin Tracking

## API Endpoints

### Worker Endpoint

```
GET https://alphascan.famlabsoffice.workers.dev/?auth=TGMFAM2026
```

**Response:**

```json
{
  "timestamp": "2026-03-25T02:30:38.230Z",
  "executionTime": 1234,
  "totalMarkets": 150,
  "arbitragePairs": 3,
  "opportunitiesFound": 5,
  "profitableOpportunities": 3,
  "opportunities": [
    {
      "pairId": "monaco-hxro-solana",
      "buyDex": "Monaco",
      "sellDex": "Hxro",
      "chain": "Solana",
      "token": "SPL_OUTCOME",
      "buyPrice": 45.23,
      "sellPrice": 47.89,
      "priceDifference": 2.66,
      "percentageDifference": 5.88,
      "profitMargin": 5.38,
      "volume": 5000,
      "status": "PROFITABLE"
    }
  ],
  "markets": [...]
}
```

## Arbitrage-Paare Konfiguration

Die Arbitrage-Paare sind in `index.js` definiert:

```javascript
const ARBITRAGE_PAIRS = [
  {
    id: "monaco-hxro-solana",
    buy: "Monaco",
    sell: "Hxro",
    chain: "Solana",
    token: "SPL_OUTCOME",
    priority: 1,
    description: "Monaco vs Hxro - SPL Outcome Tokens (Primary Focus)"
  },
  // ... weitere Paare
];
```

### Neue Paare Hinzufügen

1. `index.js` öffnen
2. Neues Objekt zu `ARBITRAGE_PAIRS` Array hinzufügen
3. Deployen: `wrangler deploy`

## Sicherheit

### Authentifizierung

- **Methode:** Header-basiert
- **Key:** `X-FamLabs-Auth: TGMFAM2026`
- **Frontend:** Password Gate mit localStorage

### Empfehlungen

1. **Produktiv:** Verwenden Sie Cloudflare Workers Secrets für Auth-Keys
2. **Rate Limiting:** Implementieren Sie Cloudflare Rate Limiting
3. **CORS:** Bereits konfiguriert für Cross-Origin Requests

## Umgebungsvariablen

Optional können Sie Secrets in Cloudflare setzen:

```bash
wrangler secret put AUTH_PASSWORD
```

Dann in `index.js` verwenden:

```javascript
const AUTH_PASS = env.AUTH_PASSWORD || "TGMFAM2026";
```

## Monitoring & Debugging

### Logs Anzeigen

```bash
wrangler tail
```

### Local Development

```bash
wrangler dev
# Öffne http://localhost:8787
```

### Production Debugging

1. Cloudflare Dashboard → Workers → Logs
2. Überprüfe Response Status und Execution Time
3. Kontrolliere API-Antworten in Browser DevTools

## Troubleshooting

### Worker Deployment Fehler

```bash
# Überprüfe Syntax
node -c index.js

# Verbose Output
wrangler deploy --verbose
```

### Frontend Lädt nicht

1. Überprüfe GitHub Pages Settings
2. Stelle sicher, dass `index.html` im Root ist
3. Cache leeren: Ctrl+Shift+Delete

### API Antwortet nicht

1. Überprüfe Auth-Header
2. Teste mit curl:
   ```bash
   curl -H "X-FamLabs-Auth: TGMFAM2026" \
     https://alphascan.famlabsoffice.workers.dev/
   ```
3. Überprüfe Cloudflare Worker Logs

## Performance Optimierungen

### Caching

```javascript
// In index.js
const cacheKey = new Request(url, { method: 'GET' });
const cache = caches.default;
let response = await cache.match(cacheKey);
```

### Request Batching

Mehrere DEX-Anfragen werden mit `Promise.allSettled()` parallel verarbeitet.

### Daten Limits

- Max 150 Markets pro DEX
- Top 50 Opportunities in Response
- Execution Timeout: 30 Sekunden

## Weitere Ressourcen

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Pages Docs](https://docs.github.com/en/pages)

## Support

Bei Fragen oder Issues:
1. Überprüfe die Logs
2. Teste lokal mit `wrangler dev`
3. Erstelle ein GitHub Issue

---

**Version:** 2.0  
**Last Updated:** 2026-03-25  
**Primary Focus:** Monaco/Hxro on Solana with SPL Outcome Tokens
