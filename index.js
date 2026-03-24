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
    
    // Parallel Fetching (Optimized)
    const [polyRes, manifoldRes, kalshiRes] = await Promise.allSettled([
      fetch('https://gamma-api.polymarket.com/markets?active=true&limit=50&order=volume&dir=desc'),
      fetch('https://api.manifold.markets/v0/markets?limit=50&sort=updated-time'),
      fetch('https://api.elections.kalshi.com/trade-api/v2/markets?limit=50&status=open')
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
              vol: m.volume || 0,
              cat: m.category || 'General'
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
              vol: m.volume || 0,
              cat: 'Social'
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
                vol: m.volume || 0,
                cat: 'Regulated'
              });
            }
          });
        }
      } catch (e) {}
    }

    // Advanced Matching Engine (Levenshtein-ish simplified)
    const signals = [];
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    for (let i = 0; i < allMarkets.length; i++) {
      for (let j = i + 1; j < allMarkets.length; j++) {
        const m1 = allMarkets[i];
        const m2 = allMarkets[j];
        if (m1.p === m2.p) continue;

        const n1 = normalize(m1.n);
        const n2 = normalize(m2.n);
        
        // Match if one contains the other (significant overlap)
        if ((n1.includes(n2) || n2.includes(n1)) && (n1.length > 15 || n2.length > 15)) {
          const diff = Math.abs(m1.v - m2.v);
          if (diff >= 1.0) {
            signals.push({
              d: diff.toFixed(1),
              m1: m1,
              m2: m2,
              score: (diff * Math.log10(Math.max(m1.vol, m2.vol) + 10)).toFixed(1)
            });
          }
        }
      }
    }

    const responseData = {
      s: signals.sort((a, b) => b.d - a.d).slice(0, 15),
      m: allMarkets.sort((a, b) => b.vol - a.vol).slice(0, 40),
      t: Date.now() - startTime,
      ts: new Date().toISOString()
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  },
};
