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

    // --- PARALLEL FETCHING (DEVIL SPEED) ---
    const startTime = Date.now();
    
    const [polyRes, manifoldRes, kalshiRes] = await Promise.allSettled([
      fetch('https://gamma-api.polymarket.com/markets?active=true&limit=30&order=volume&dir=desc'),
      fetch('https://api.manifold.markets/v0/markets?limit=30&sort=updated-time'),
      fetch('https://api.elections.kalshi.com/trade-api/v2/markets?limit=30&status=open')
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
              p: 'Poly',
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
              p: 'Mani',
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

    // --- HIGH-PRECISION MATCHING ENGINE ---
    const signals = [];
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
    
    // Group by normalized name to find matches faster
    const groups = {};
    allMarkets.forEach(m => {
      const key = normalize(m.n);
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });

    for (const key in groups) {
      const matches = groups[key];
      if (matches.length > 1) {
        // Compare all pairs in the group
        for (let i = 0; i < matches.length; i++) {
          for (let j = i + 1; j < matches.length; j++) {
            const m1 = matches[i];
            const m2 = matches[j];
            if (m1.p === m2.p) continue;

            const diff = Math.abs(m1.v - m2.v);
            if (diff >= 0.5) { // Ultra-accurate: detect even 0.5% spreads
              signals.push({
                d: diff.toFixed(2),
                m1: m1,
                m2: m2,
                score: (diff * Math.log10(Math.max(m1.vol, m2.vol) + 1)).toFixed(1)
              });
            }
          }
        }
      }
    }

    const responseData = {
      s: signals.sort((a, b) => b.d - a.d),
      m: allMarkets.sort((a, b) => b.vol - a.vol).slice(0, 25),
      t: Date.now() - startTime, // Processing time in ms
      ts: new Date().toISOString()
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  },
};
