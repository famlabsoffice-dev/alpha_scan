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

    let allMarkets = [];

    // 1. Polymarket Gamma API
    try {
      const polyResponse = await fetch('https://gamma-api.polymarket.com/markets?active=true&limit=20&order=volume&dir=desc');
      const polyData = await polyResponse.json();
      polyData.forEach(m => {
        if (m.outcomePrices) {
          const prices = JSON.parse(m.outcomePrices);
          allMarkets.push({
            platform: 'Polymarket',
            name: m.question.trim(),
            price: parseFloat(prices[0]) * 100,
            url: `https://polymarket.com/event/${m.slug}`,
            volume: m.volume || 0
          });
        }
      });
    } catch (e) { console.error('Polymarket Error:', e); }

    // 2. Manifold Markets
    try {
      const manifoldResponse = await fetch('https://api.manifold.markets/v0/markets?limit=20&sort=updated-time');
      const manifoldData = await manifoldResponse.json();
      manifoldData.forEach(m => {
        if (m.probability !== undefined) {
          allMarkets.push({
            platform: 'Manifold',
            name: m.question.trim(),
            price: m.probability * 100,
            url: m.url,
            volume: m.volume || 0
          });
        }
      });
    } catch (e) { console.error('Manifold Error:', e); }

    // 3. Kalshi
    try {
      const kalshiResponse = await fetch('https://api.elections.kalshi.com/trade-api/v2/markets?limit=20&status=open');
      const kalshiData = await kalshiResponse.json();
      if (kalshiData.markets) {
        kalshiData.markets.forEach(m => {
          if (m.yes_bid) {
            allMarkets.push({
              platform: 'Kalshi',
              name: m.title.trim(),
              price: parseFloat(m.yes_bid),
              url: `https://kalshi.com/markets/${m.ticker}`,
              volume: m.volume || 0
            });
          }
        });
      }
    } catch (e) { console.error('Kalshi Error:', e); }

    // --- ARBITRAGE MATCHING LOGIK ---
    let arbitrageSignals = [];
    const normalized = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (let i = 0; i < allMarkets.length; i++) {
      for (let j = i + 1; j < allMarkets.length; j++) {
        const m1 = allMarkets[i];
        const m2 = allMarkets[j];

        if (m1.platform === m2.platform) continue;

        // Einfaches Matching über Textähnlichkeit (erste 20 Zeichen normalisiert)
        const n1 = normalized(m1.name).substring(0, 25);
        const n2 = normalized(m2.name).substring(0, 25);

        if (n1 === n2 && n1.length > 10) {
          const diff = Math.abs(m1.price - m2.price);
          if (diff >= 1.0) { // Mindestens 1% Differenz
            arbitrageSignals.push({
              type: 'ARBITRAGE',
              market1: m1,
              market2: m2,
              difference: diff.toFixed(1) + '%',
              severity: diff > 5 ? 'CRITICAL' : 'OPPORTUNITY'
            });
          }
        }
      }
    }

    const responseData = {
      signals: arbitrageSignals.sort((a, b) => parseFloat(b.difference) - parseFloat(a.difference)),
      all_markets: allMarkets.sort((a, b) => b.volume - a.volume).slice(0, 20),
      timestamp: new Date().toISOString(),
      status: "SCANNER_LIVE_V2.2"
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  },
};
