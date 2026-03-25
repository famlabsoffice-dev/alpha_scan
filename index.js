export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers'),
        },
      });
    }

    const startTime = Date.now();
    const AUTH_PASS = "TGMFAM2026";

    // 1. Simple Auth Check
    const url = new URL(request.url);
    const providedPass = request.headers.get('X-FamLabs-Auth') || url.searchParams.get('auth');

    if (providedPass !== AUTH_PASS) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED_ACCESS", msg: "FamLabs Terminal Restricted. Authentication Required." }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Data Ingestion from Real APIs with robust error handling
    const fetchWithTimeout = async (url, timeout = 5000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (e) {
        clearTimeout(id);
        throw e;
      }
    };

    const [polyRes, binanceBtcRes, binanceSolRes, jupSolRes] = await Promise.allSettled([
      fetchWithTimeout('https://gamma-api.polymarket.com/markets?active=true&limit=100&order=volume&dir=desc'),
      fetchWithTimeout('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
      fetchWithTimeout('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT'),
      fetchWithTimeout('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112') // Correct Jupiter V2 API for SOL
    ]);

    let allMarkets = [];
    let cryptoPrices = {};

    // Process Crypto Prices
    if (binanceBtcRes.status === 'fulfilled' && binanceBtcRes.value.ok) {
      try {
        const data = await binanceBtcRes.value.json();
        cryptoPrices['BTC'] = parseFloat(data.price);
      } catch (e) {}
    }
    if (binanceSolRes.status === 'fulfilled' && binanceSolRes.value.ok) {
      try {
        const data = await binanceSolRes.value.json();
        cryptoPrices['SOL_BINANCE'] = parseFloat(data.price);
      } catch (e) {}
    }
    if (jupSolRes.status === 'fulfilled' && jupSolRes.value.ok) {
      try {
        const data = await jupSolRes.value.json();
        if (data.data && data.data['So11111111111111111111111111111111111111112']) {
          cryptoPrices['SOL_JUPITER'] = parseFloat(data.data['So11111111111111111111111111111111111111112'].price);
        }
      } catch (e) {}
    }

    // Process Polymarket Data
    if (polyRes.status === 'fulfilled' && polyRes.value.ok) {
      try {
        const data = await polyRes.value.json();
        data.forEach(m => {
          if (m.outcomePrices) {
            const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
            const yesPrice = parseFloat(prices[0]);
            const noPrice = parseFloat(prices[1]);
            
            if (!isNaN(yesPrice)) {
              allMarkets.push({
                p: 'Polymarket',
                n: m.question.trim(),
                v: yesPrice * 100, // YES price in cents
                no_v: noPrice * 100, // NO price in cents
                u: `https://polymarket.com/event/${m.slug}`,
                vol: parseFloat(m.volume) || 0,
                fee: 0.002,
                chain: 'Polygon',
                token: 'USDC'
              });
            }
          }
        });
      } catch (e) {}
    }

    // 3. Arbitrage Detection & Profit Calculation
    const opportunities = [];

    // Crypto Arbitrage (Binance vs Jupiter for SOL)
    if (cryptoPrices['SOL_BINANCE'] && cryptoPrices['SOL_JUPITER']) {
      const bPrice = cryptoPrices['SOL_BINANCE'];
      const jPrice = cryptoPrices['SOL_JUPITER'];
      const diff = Math.abs(bPrice - jPrice);
      const percentDiff = (diff / Math.min(bPrice, jPrice)) * 100;

      if (percentDiff > 0.01) { // Lower threshold for visibility
        const buyDex = bPrice < jPrice ? 'Binance' : 'Jupiter';
        const sellDex = bPrice < jPrice ? 'Jupiter' : 'Binance';
        const buyPrice = Math.min(bPrice, jPrice);
        const sellPrice = Math.max(bPrice, jPrice);

        opportunities.push({
          pairId: "sol-arb",
          buyDex: buyDex,
          sellDex: sellDex,
          chain: "Solana",
          token: "SOL",
          buyPrice: buyPrice,
          sellPrice: sellPrice,
          priceDifference: diff,
          percentageDifference: percentDiff,
          profitMargin: percentDiff - 0.05, // Lower estimated fees
          volume: 50000,
          buyMarket: "SOL/USDT",
          sellMarket: "SOL/USDC",
          timestamp: Date.now(),
          status: 'PROFITABLE',
          isCrypto: true
        });
      }
    }

    // Prediction Market Arbitrage
    allMarkets.forEach(m => {
      const yesPrice = m.v / 100;
      const noPrice = m.no_v / 100;
      const sum = yesPrice + noPrice;
      
      if (sum < 0.995) { // 0.5% spread threshold
        opportunities.push({
          pairId: "poly-internal",
          buyDex: "Polymarket",
          sellDex: "Polymarket",
          chain: "Polygon",
          token: "USDC",
          buyPrice: yesPrice * 100,
          sellPrice: (1 - noPrice) * 100,
          priceDifference: (1 - sum) * 100,
          percentageDifference: ((1 - sum) / sum) * 100,
          profitMargin: ((1 - sum) / sum) * 100 - 0.1,
          volume: m.vol / 10,
          buyMarket: m.n,
          sellMarket: m.n,
          timestamp: Date.now(),
          status: 'PROFITABLE'
        });
      }
    });

    // 4. Response Formatting
    const response = {
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime,
      totalMarkets: allMarkets.length,
      opportunitiesFound: opportunities.length,
      opportunities: opportunities.sort((a, b) => b.profitMargin - a.profitMargin).slice(0, 20),
      markets: allMarkets.slice(0, 50),
      crypto: cryptoPrices,
      status: 'SUCCESS'
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
