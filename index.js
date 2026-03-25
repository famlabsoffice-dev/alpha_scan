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
    
    // Multi-Source Data Ingestion (Increased Limits)
    const [polyRes, manifoldRes, kalshiRes] = await Promise.allSettled([
      fetch('https://gamma-api.polymarket.com/markets?active=true&limit=100&order=volume&dir=desc'),
      fetch('https://api.manifold.markets/v0/markets?limit=100&sort=updated-time'),
      fetch('https://api.elections.kalshi.com/trade-api/v2/markets?limit=100&status=open')
    ]);

    let allMarkets = [];

    // Polymarket (Fee approx 0.2%)
    if (polyRes.status === 'fulfilled') {
      try {
        const data = await polyRes.value.json();
        data.forEach(m => {
          if (m.outcomePrices) {
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

    // Manifold (Fee 0% - Virtual)
    if (manifoldRes.status === 'fulfilled') {
      try {
        const data = await manifoldRes.value.json();
        data.forEach(m => {
          if (m.probability !== undefined) {
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

    // Kalshi (Fee approx 0.5%)
    if (kalshiRes.status === 'fulfilled') {
      try {
        const data = await kalshiRes.value.json();
        if (data.markets) {
          data.markets.forEach(m => {
            if (m.yes_bid) {
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

    // --- ORACLE MATCHING ENGINE v4.0 ---
    const semanticNormalize = (s) => {
      return s.toLowerCase()
        .replace(/will|is|the|be|over|under|above|below|at|in|on|by/g, '')
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 40);
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
        // Fee Deduction Logic (Net Profit)
        const totalFees = (min.fee + max.fee) * 100;
        const netDiff = rawDiff - totalFees;

        if (netDiff > 0.2) {
          arb = {
            raw: rawDiff.toFixed(1),
            net: netDiff.toFixed(1),
            buy: min,
            sell: max,
            // Confidence Score (Volume + Net Spread)
            score: Math.min(100, (netDiff * 10 + Math.log10(group.totalVol + 1) * 5)).toFixed(1)
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
      f: matrix.sort((a, b) => b.totalVol - a.totalVol).slice(0, 40),
      t: Date.now() - startTime,
      ts: new Date().toISOString()
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  },
};
