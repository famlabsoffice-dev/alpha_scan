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
    
    // Parallel Fetching (Increased Limits for Matrix)
    const [polyRes, manifoldRes, kalshiRes] = await Promise.allSettled([
      fetch('https://gamma-api.polymarket.com/markets?active=true&limit=60&order=volume&dir=desc'),
      fetch('https://api.manifold.markets/v0/markets?limit=60&sort=updated-time'),
      fetch('https://api.elections.kalshi.com/trade-api/v2/markets?limit=60&status=open')
    ]);

    let allMarkets = [];

    // Polymarket Parser
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
              vol: m.volume || 0
            });
          }
        });
      } catch (e) {}
    }

    // Manifold Parser
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
              vol: m.volume || 0
            });
          }
        });
      } catch (e) {}
    }

    // Kalshi Parser
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
                vol: m.volume || 0
              });
            }
          });
        }
      } catch (e) {}
    }

    // --- INTELLIGENT GROUPING ENGINE ---
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 35);
    const grouped = {};
    
    allMarkets.forEach(m => {
      const key = normalize(m.n);
      if (!grouped[key]) {
        grouped[key] = {
          name: m.n,
          markets: [],
          maxVol: 0
        };
      }
      grouped[key].markets.push(m);
      grouped[key].maxVol = Math.max(grouped[key].maxVol, m.vol);
    });

    // Convert to Array and calculate arbitrage within groups
    const feed = Object.values(grouped).map(group => {
      let arb = null;
      if (group.markets.length > 1) {
        let min = group.markets[0], max = group.markets[0];
        group.markets.forEach(m => {
          if (m.v < min.v) min = m;
          if (m.v > max.v) max = m;
        });
        const diff = max.v - min.v;
        if (diff >= 0.5) {
          arb = {
            diff: diff.toFixed(1),
            buy: min,
            sell: max,
            score: (diff * Math.log10(group.maxVol + 10)).toFixed(1)
          };
        }
      }
      return { ...group, arb };
    });

    // Separate standalone signals for the left column
    const signals = feed.filter(f => f.arb !== null).map(f => ({
      d: f.arb.diff,
      m1: f.arb.buy,
      m2: f.arb.sell,
      score: f.arb.score,
      name: f.name
    })).sort((a, b) => b.d - a.d);

    const responseData = {
      s: signals,
      f: feed.sort((a, b) => b.maxVol - a.maxVol).slice(0, 30),
      t: Date.now() - startTime,
      ts: new Date().toISOString()
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  },
};
