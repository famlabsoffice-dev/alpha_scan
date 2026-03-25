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
    const currentYear = 2026;
    const AUTH_PASS = "TGMFAM2026";

    // 1. Simple Auth Check (via Header or Query)
    const url = new URL(request.url);
    const providedPass = request.headers.get('X-FamLabs-Auth') || url.searchParams.get('auth');

    if (providedPass !== AUTH_PASS) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED_ACCESS", msg: "FamLabs Terminal Restricted. Authentication Required." }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Cross-DEX Arbitrage Pair Configuration
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
      {
        id: "polymarket-uniswap-polygon",
        buy: "Polymarket",
        sell: "UniswapV3",
        chain: "Polygon",
        token: "ERC1155_CTF",
        priority: 2,
        description: "Polymarket vs UniswapV3 - ERC1155 Conditional Tokens"
      },
      {
        id: "jupiterpm-polybridge-solana",
        buy: "JupiterPM",
        sell: "PolymarketBridge",
        chain: "Solana",
        token: "WPM_SHARE",
        priority: 3,
        description: "JupiterPM vs PolymarketBridge - Wrapped PM Shares"
      }
    ];

    // 3. Data Ingestion (Enhanced Limits)
    const [polyRes, manifoldRes, kalshiRes] = await Promise.allSettled([
      fetch('https://gamma-api.polymarket.com/markets?active=true&limit=150&order=volume&dir=desc'),
      fetch('https://api.manifold.markets/v0/markets?limit=150&sort=updated-time'),
      fetch('https://api.elections.kalshi.com/trade-api/v2/markets?limit=100&status=open')
    ]);

    let allMarkets = [];

    const isMarketCurrent = (title, closedDate) => {
      if (closedDate) {
        const year = new Date(closedDate).getFullYear();
        if (year < currentYear) return false;
      }
      const oldYearMatch = title.match(/\b(202[0-5]|201[0-9])\b/);
      return !oldYearMatch;
    };

    // Polymarket Data
    if (polyRes.status === 'fulfilled') {
      try {
        const data = await polyRes.value.json();
        data.forEach(m => {
          if (m.outcomePrices && isMarketCurrent(m.question, m.closedTime)) {
            const prices = JSON.parse(m.outcomePrices);
            allMarkets.push({
              p: 'Polymarket',
              n: m.question.trim(),
              v: parseFloat(prices[0]) * 100,
              u: `https://polymarket.com/event/${m.slug}`,
              vol: parseFloat(m.volume) || 0,
              fee: 0.002,
              chain: 'Polygon',
              token: 'ERC1155_CTF'
            });
          }
        });
      } catch (e) {}
    }

    // Manifold Data
    if (manifoldRes.status === 'fulfilled') {
      try {
        const data = await manifoldRes.value.json();
        data.forEach(m => {
          if (m.probability !== undefined && isMarketCurrent(m.question, m.closeTime)) {
            allMarkets.push({
              p: 'Manifold',
              n: m.question.trim(),
              v: m.probability * 100,
              u: m.url,
              vol: m.volume || 0,
              fee: 0,
              chain: 'Ethereum',
              token: 'ERC20'
            });
          }
        });
      } catch (e) {}
    }

    // Kalshi Data
    if (kalshiRes.status === 'fulfilled') {
      try {
        const data = await kalshiRes.value.json();
        if (data.markets) {
          data.markets.forEach(m => {
            if (m.yes_bid && isMarketCurrent(m.title, m.close_time)) {
              allMarkets.push({
                p: 'Kalshi',
                n: m.title.trim(),
                v: parseFloat(m.yes_bid),
                u: `https://kalshi.com/markets/${m.ticker}`,
                vol: parseFloat(m.volume) || 0,
                fee: 0.004,
                chain: 'Ethereum',
                token: 'ERC20'
              });
            }
          });
        }
      } catch (e) {}
    }

    // 4. Arbitrage Detection Engine
    const detectArbitrages = (markets, pairs) => {
      const opportunities = [];
      
      for (const pair of pairs) {
        // Find markets matching this pair's DEXs
        const buyMarkets = markets.filter(m => m.p.toLowerCase() === pair.buy.toLowerCase());
        const sellMarkets = markets.filter(m => m.p.toLowerCase() === pair.sell.toLowerCase());

        for (const buyM of buyMarkets) {
          for (const sellM of sellMarkets) {
            // Check if same chain and token
            if (buyM.chain === sellM.chain && buyM.token === sellM.token) {
              const priceDiff = sellM.v - buyM.v;
              const percentDiff = (priceDiff / buyM.v) * 100;
              const minVolume = Math.min(buyM.vol, sellM.vol);
              
              // Thresholds
              const minPriceDiff = 1; // 1%
              const minVolumeThreshold = 100; // $100

              if (percentDiff >= minPriceDiff && minVolume >= minVolumeThreshold) {
                const profitMargin = percentDiff - 0.5; // Account for 0.5% spread
                
                opportunities.push({
                  pairId: pair.id,
                  buyDex: pair.buy,
                  sellDex: pair.sell,
                  chain: pair.chain,
                  token: pair.token,
                  buyPrice: buyM.v,
                  sellPrice: sellM.v,
                  priceDifference: priceDiff,
                  percentageDifference: percentDiff,
                  profitMargin: profitMargin,
                  volume: minVolume,
                  buyMarket: buyM.n,
                  sellMarket: sellM.n,
                  timestamp: Date.now(),
                  status: profitMargin > 0 ? 'PROFITABLE' : 'MARGINAL'
                });
              }
            }
          }
        }
      }

      // Sort by profit margin
      return opportunities.sort((a, b) => b.profitMargin - a.profitMargin);
    };

    const opportunities = detectArbitrages(allMarkets, ARBITRAGE_PAIRS);

    // 5. Response Formatting
    const response = {
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime,
      totalMarkets: allMarkets.length,
      arbitragePairs: ARBITRAGE_PAIRS.length,
      opportunitiesFound: opportunities.length,
      profitableOpportunities: opportunities.filter(o => o.status === 'PROFITABLE').length,
      opportunities: opportunities.slice(0, 50), // Top 50
      markets: allMarkets.slice(0, 100), // Top 100 markets
      status: 'SUCCESS'
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
