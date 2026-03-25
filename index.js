/**
 * FamilyLaboratories Alpha Scan v2.4
 * Cloudflare Worker – Cross-DEX Arbitrage Engine
 *
 * 100% LIVE DATA ONLY – NO SIMULATIONS
 * Graceful Degradation: Wenn eine API fehlt, zeigen wir die anderen trotzdem
 * 
 * Live Price Sources (all public, no API key required):
 *   ✓ Kraken Public API        (SOL, BTC, ETH ticker + recent trades)
 *   ✓ Polymarket CLOB          (ONLY ACTIVE, NON-CLOSED markets)
 *   ✓ Manifold Markets API     (ONLY NON-RESOLVED markets)
 *   ✓ Raydium Pools API        (SOL DEX liquidity pools)
 *   ✓ Orca Pools API           (SOL DEX liquidity pools)
 *   ✓ CoinGecko Demo           (Fallback crypto prices)
 */

// ─── Profit Calculator ────────────────────────────────────────────────────────
function calcProfit(buyPrice, sellPrice, amount, feesBuy = 0.002, feesSell = 0.002) {
  if (buyPrice <= 0 || sellPrice <= 0) return { net: 0, gross: 0, shares: 0, roi: 0 };
  const shares     = amount / buyPrice;
  const gross      = shares * sellPrice;
  const totalFees  = amount * (feesBuy + feesSell);
  const net        = gross - amount - totalFees;
  const roi        = (net / amount) * 100;
  return { net: parseFloat(net.toFixed(4)), gross: parseFloat(gross.toFixed(4)), shares: parseFloat(shares.toFixed(4)), roi: parseFloat(roi.toFixed(4)) };
}

// ─── Volatility Calculator (USP) ──────────────────────────────────────────────
function calcVolatilityIndex(trades) {
  if (!trades || trades.length < 2) return 0;
  const prices = trades.map(t => parseFloat(t[0])).slice(0, 100);
  if (prices.length < 2) return 0;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const coeffVar = (stdDev / mean) * 100;
  const volatilityIndex = Math.min(100, Math.max(0, (coeffVar / 1) * 100));
  return parseFloat(volatilityIndex.toFixed(1));
}

// ─── Fetch Helper with Timeout ───────────────────────────────────────────────
async function fetchJSON(url, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { 
      signal: controller.signal, 
      headers: { 'User-Agent': 'FamLabs-AlphaScan/2.4' } 
    });
    clearTimeout(id);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

// ─── Safe Fetch (returns null on error, never throws) ────────────────────────
async function safeFetch(url, timeout = 5000) {
  try {
    return await fetchJSON(url, timeout);
  } catch (e) {
    console.warn(`API Error: ${url} – ${e.message}`);
    return null;
  }
}

// ─── Main Worker ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {

    const corsHeaders = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Max-Age':       '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: { ...corsHeaders, 'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') },
      });
    }

    const startTime = Date.now();
    const AUTH_PASS = env.AUTH_PASSWORD || "TGMFAM2026";

    // ── Auth ──────────────────────────────────────────────────────────────────
    const url          = new URL(request.url);
    const providedPass = request.headers.get('X-FamLabs-Auth') || url.searchParams.get('auth');

    if (providedPass !== AUTH_PASS) {
      return new Response(JSON.stringify({
        error: "UNAUTHORIZED_ACCESS",
        msg:   "FamLabs Terminal Restricted. Authentication Required.",
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Parallel Data Fetch (Graceful Degradation) ────────────────────────────
    const [
      krakenSolRes,
      krakenBtcRes,
      krakenEthRes,
      krakenSolTradesRes,
      polymarketsRes,
      manifoldRes,
      raydiumRes,
      orcaRes,
      coingeckoRes,
    ] = await Promise.all([
      safeFetch('https://api.kraken.com/0/public/Ticker?pair=SOLUSD', 5000),
      safeFetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSD', 5000),
      safeFetch('https://api.kraken.com/0/public/Ticker?pair=ETHUSD', 5000),
      safeFetch('https://api.kraken.com/0/public/Trades?pair=SOLUSD', 5000),
      safeFetch('https://clob.polymarket.com/markets?active=true&closed=false&limit=200', 6000),
      safeFetch('https://api.manifold.markets/v0/markets?limit=100', 6000),
      safeFetch('https://api.raydium.io/v2/main/pairs?limit=100', 6000),
      safeFetch('https://api.orca.so/pools', 6000),
      safeFetch('https://api.coingecko.com/api/v3/simple/price?ids=solana,bitcoin,ethereum&vs_currencies=usd', 5000),
    ]);

    // ── Parse Crypto Prices (Graceful Degradation) ──────────────────────────────
    const crypto = {};
    let volatilityIndex = 0;

    // Kraken SOL
    if (krakenSolRes?.result) {
      try {
        const r = krakenSolRes.result;
        const k = Object.keys(r)[0];
        if (k && r[k]?.c?.[0]) crypto.SOL_KRAKEN = parseFloat(r[k].c[0]);
      } catch (_) {}
    }

    // Kraken BTC
    if (krakenBtcRes?.result) {
      try {
        const r = krakenBtcRes.result;
        const k = Object.keys(r)[0];
        if (k && r[k]?.c?.[0]) crypto.BTC_KRAKEN = parseFloat(r[k].c[0]);
      } catch (_) {}
    }

    // Kraken ETH
    if (krakenEthRes?.result) {
      try {
        const r = krakenEthRes.result;
        const k = Object.keys(r)[0];
        if (k && r[k]?.c?.[0]) crypto.ETH_KRAKEN = parseFloat(r[k].c[0]);
      } catch (_) {}
    }

    // Kraken SOL Trades → Volatility Index
    if (krakenSolTradesRes?.result) {
      try {
        const r = krakenSolTradesRes.result;
        const k = Object.keys(r)[0];
        const trades = r[k] || [];
        volatilityIndex = calcVolatilityIndex(trades);
      } catch (_) {}
    }

    // CoinGecko fallback
    if (coingeckoRes) {
      try {
        if (!crypto.SOL_KRAKEN)  crypto.SOL_COINGECKO = coingeckoRes?.solana?.usd;
        if (!crypto.BTC_KRAKEN)  crypto.BTC_COINGECKO = coingeckoRes?.bitcoin?.usd;
        if (!crypto.ETH_KRAKEN)  crypto.ETH_COINGECKO = coingeckoRes?.ethereum?.usd;
      } catch (_) {}
    }

    // Canonical prices
    crypto.SOL = crypto.SOL_KRAKEN || crypto.SOL_COINGECKO || 0;
    crypto.BTC = crypto.BTC_KRAKEN || crypto.BTC_COINGECKO || 0;
    crypto.ETH = crypto.ETH_KRAKEN || crypto.ETH_COINGECKO || 0;

    // ── Parse All Markets (Graceful Degradation) ──────────────────────────────
    const allMarkets = [];
    const now = Date.now();

    // 1. Polymarket CLOB
    if (polymarketsRes?.data && Array.isArray(polymarketsRes.data)) {
      try {
        const data = polymarketsRes.data;
        data.forEach(m => {
          if (!m.active || m.closed || m.archived) return;
          const tokens = m.tokens || [];
          if (tokens.length < 2) return;
          const yesToken = tokens.find(t => t.outcome?.toUpperCase() === 'YES') || tokens[0];
          const noToken  = tokens.find(t => t.outcome?.toUpperCase() === 'NO')  || tokens[1];
          const yesPrice = parseFloat(yesToken?.price || 0);
          const noPrice  = parseFloat(noToken?.price  || 0);
          if (isNaN(yesPrice) || isNaN(noPrice)) return;
          if (yesPrice <= 0 || yesPrice >= 1) return;
          if (noPrice <= 0 || noPrice >= 1) return;
          allMarkets.push({
            p: 'Polymarket', n: (m.question || '').trim(), v: yesPrice * 100, no_v: noPrice * 100,
            yes_raw: yesPrice, no_raw: noPrice, u: `https://polymarket.com/event/${m.market_slug || m.condition_id}`,
            vol: 0, fee: parseFloat(m.maker_base_fee || 0.002), chain: 'Polygon', token: 'USDC', condId: m.condition_id || '',
          });
        });
      } catch (e) { console.warn('Polymarket parse error:', e); }
    }

    // 2. Manifold Markets
    if (Array.isArray(manifoldRes)) {
      try {
        manifoldRes.forEach(m => {
          if (m.isResolved) return;
          const closeTime = m.closeTime || 0;
          if (closeTime > 0 && closeTime < now) return;
          if (!m.question) return;
          const prob = m.probability;
          if (prob === null || prob === undefined || isNaN(prob)) return;
          const probVal = Math.max(0.01, Math.min(0.99, prob / 100));
          const counterProb = 1 - probVal;
          allMarkets.push({
            p: 'Manifold', n: m.question.substring(0, 100), v: probVal * 100, no_v: counterProb * 100,
            yes_raw: probVal, no_raw: counterProb, u: m.url || `https://manifold.markets/${m.id}`,
            vol: m.volume24Hours || 0, fee: 0.002, chain: 'Polygon', token: 'USDC', condId: m.id || '',
          });
        });
      } catch (e) { console.warn('Manifold parse error:', e); }
    }

    // 3. Raydium Pools
    if (Array.isArray(raydiumRes)) {
      try {
        raydiumRes.slice(0, 30).forEach(p => {
          if (!p.name || !p.liquidity) return;
          const liq = parseFloat(p.liquidity);
          if (liq < 10000) return;
          allMarkets.push({
            p: 'Raydium', n: p.name, v: 0, no_v: 0, yes_raw: 0, no_raw: 0,
            u: `https://raydium.io/swap/`, vol: liq, fee: 0.0025, chain: 'Solana', token: 'SPL', condId: p.ammId || '',
          });
        });
      } catch (e) { console.warn('Raydium parse error:', e); }
    }

    // 4. Orca Pools
    if (Array.isArray(orcaRes)) {
      try {
        orcaRes.slice(0, 30).forEach(p => {
          if (!p.name) return;
          allMarkets.push({
            p: 'Orca', n: p.name, v: 0, no_v: 0, yes_raw: 0, no_raw: 0,
            u: `https://www.orca.so/`, vol: 0, fee: 0.0030, chain: 'Solana', token: 'SPL', condId: p.account || '',
          });
        });
      } catch (e) { console.warn('Orca parse error:', e); }
    }

    // ── Arbitrage Detection ──────────────────────────────────────────────────────
    const opportunities = [];

    allMarkets.forEach(m => {
      if (!m.yes_raw || !m.no_raw) return;
      const yesPrice = m.yes_raw;
      const noPrice  = m.no_raw;
      const sum      = yesPrice + noPrice;
      if (sum >= 0.990 || sum <= 0.01) return;
      const spread    = 1 - sum;
      const pctSpread = (spread / sum) * 100;
      const totalFees = (m.fee * 2) * 100;
      if (pctSpread <= totalFees + 0.1) return;
      const p5  = calcProfit(yesPrice, 1 - yesPrice, 5,  m.fee, m.fee);
      const p10 = calcProfit(yesPrice, 1 - yesPrice, 10, m.fee, m.fee);
      const p25 = calcProfit(yesPrice, 1 - yesPrice, 25, m.fee, m.fee);
      opportunities.push({
        pairId: `${m.p.toLowerCase()}-internal-${(m.condId || '').slice(0, 8)}`,
        title: m.n, buyDex: `${m.p} YES`, sellDex: `${m.p} NO`, chain: m.chain, token: m.token,
        buyPrice: yesPrice * 100, sellPrice: (1 - yesPrice) * 100,
        priceDifference: spread * 100, percentageDifference: pctSpread, profitMargin: pctSpread - totalFees,
        profit5: p5.net, profit10: p10.net, profit25: p25.net, roi5: p5.roi, roi10: p10.roi, roi25: p25.roi,
        volume: m.vol / 10, buyMarket: m.n, sellMarket: m.n, timestamp: Date.now(), status: 'PROFITABLE',
        isCrypto: false, description: `${m.p} YES+NO < 1.0 – risk-free spread (100% LIVE)`, source: m.p,
      });
    });

    // ─── Response ──────────────────────────────────────────────────────────────
    const sortedOpps = opportunities.sort((a, b) => b.profitMargin - a.profitMargin).slice(0, 50);

    const response = {
      timestamp:            new Date().toISOString(),
      executionTime:        Date.now() - startTime,
      version:              "2.4",
      totalMarkets:         allMarkets.length,
      opportunitiesFound:   sortedOpps.length,
      opportunities:        sortedOpps,
      markets:              allMarkets.slice(0, 100),
      crypto:               crypto,
      volatilityIndex:      volatilityIndex,
      dataSources: {
        kraken:             crypto.SOL_KRAKEN ? "✓ Live" : "✗ Offline",
        polymarket:         allMarkets.some(m => m.p === 'Polymarket') ? "✓ Live" : "✗ Offline",
        manifold:           allMarkets.some(m => m.p === 'Manifold') ? "✓ Live" : "✗ Offline",
        raydium:            allMarkets.some(m => m.p === 'Raydium') ? "✓ Live" : "✗ Offline",
        orca:               allMarkets.some(m => m.p === 'Orca') ? "✓ Live" : "✗ Offline",
        coingecko:          crypto.SOL_COINGECKO ? "✓ Live" : "✗ Offline",
      },
      status:               'SUCCESS',
      dataQuality:          '100% LIVE DATA ONLY',
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
