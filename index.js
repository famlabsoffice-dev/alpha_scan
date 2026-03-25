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

    // 2. Data Ingestion (Enhanced Limits)
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
              fee: 0.002
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
              fee: 0
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
                vol: m.volume || 0,
                fee: 0.005
              });
            }
          });
        }
      } catch (e) {}
    }

    // --- HYPER-SENSITIVE MATCHING ENGINE v4.5 ---
    const semanticNormalize = (s) => {
      return s.toLowerCase()
        .replace(/will|is|the|be|over|under|above|below|at|in|on|by|who|which|how|many|a|an|of|for|to/g, '')
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 30); // Focus on first 30 core characters for better matching
    };

    const grouped = {};
    allMarkets.forEach(m => {
      const key = semanticNormalize(m.n);
      if (!grouped[key]) {
        grouped[key] = { name: m.n, markets: [], totalVol: 0 };
      }
      grouped[key].markets.push(m);
      grouped[key].totalVol += m.vol;
    });

    const matrix = Object.values(grouped).map(group => {
      let arb = null;
      if (group.markets.length > 1) {
        let min = group.markets[0], max = group.markets[0];
        group.markets.forEach(m => {
          if (m.v < min.v) min = m;
          if (m.v > max.v) max = m;
        });
        
        const rawDiff = max.v - min.v;
        const totalFees = (min.fee + max.fee) * 100;
        const netDiff = rawDiff - totalFees;

        if (netDiff > 0.1) {
          arb = {
            raw: rawDiff.toFixed(1),
            net: netDiff.toFixed(1),
            buy: min,
            sell: max,
            score: Math.min(100, (netDiff * 15 + Math.log10(group.totalVol + 1) * 5)).toFixed(1)
          };
        }
      }
      return { ...group, arb };
    });

    const responseData = {
      s: matrix.filter(f => f.arb).map(f => ({
        n: f.name,
        d: f.arb.net,
        rd: f.arb.raw,
        m1: f.arb.buy,
        m2: f.arb.sell,
        sc: f.arb.score
      })).sort((a, b) => b.d - a.d),
      f: matrix.sort((a, b) => b.totalVol - a.totalVol).slice(0, 60),
      t: Date.now() - startTime,
      ts: new Date().toISOString()
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  },
};
