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

    let arbitrageResults = [];

    // 1. Polymarket Gamma API (Öffentlich)
    try {
      // Abfrage der neuesten aktiven Märkte
      const polyResponse = await fetch('https://gamma-api.polymarket.com/markets?active=true&limit=10&order=volume&dir=desc');
      const polyData = await polyResponse.json();
      
      polyData.forEach(market => {
        if (market.outcomePrices) {
          const prices = JSON.parse(market.outcomePrices);
          const yesPrice = (parseFloat(prices[0]) * 100).toFixed(1);
          arbitrageResults.push({
            platform: 'Polymarket',
            name: market.question,
            price: `${yesPrice}%`,
            url: `https://polymarket.com/event/${market.slug}`,
            volume: market.volume || 'N/A'
          });
        }
      });
    } catch (e) {
      console.error('Polymarket Error:', e);
    }

    // 2. Manifold Markets (Öffentlich)
    try {
      const manifoldResponse = await fetch('https://api.manifold.markets/v0/markets?limit=10&sort=updated-time');
      const manifoldData = await manifoldResponse.json();
      manifoldData.forEach(market => {
        if (market.probability !== undefined) {
          arbitrageResults.push({
            platform: 'Manifold',
            name: market.question,
            price: `${(market.probability * 100).toFixed(1)}%`,
            url: market.url,
            volume: market.volume || 'N/A'
          });
        }
      });
    } catch (e) {
      console.error('Manifold Error:', e);
    }

    // 3. Kalshi (Öffentlich)
    try {
      const kalshiResponse = await fetch('https://api.elections.kalshi.com/trade-api/v2/markets?limit=10&status=open');
      const kalshiData = await kalshiResponse.json();
      if (kalshiData.markets) {
        kalshiData.markets.forEach(market => {
          if (market.yes_bid) {
            arbitrageResults.push({
              platform: 'Kalshi',
              name: market.title,
              price: `${market.yes_bid}%`,
              url: `https://kalshi.com/markets/${market.ticker}`,
              volume: market.volume || 'N/A'
            });
          }
        });
      }
    } catch (e) {
      console.error('Kalshi Error:', e);
    }

    const responseData = {
      results: arbitrageResults.sort((a, b) => (b.volume || 0) - (a.volume || 0)),
      timestamp: new Date().toISOString(),
      status: "LIVE_DATA_FEED_ACTIVE"
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  },
};
