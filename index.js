export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
      'Access-Control-Max-Age': '86400',
    };

    // Handle OPTIONS request for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers'),
        },
      });
    }

    // Example Arbitrage Data
    const data = {
      results: [
        { name: "BTC/USDT Arbitrage (Binance vs Kraken)", diff: "+1.25%" },
        { name: "ETH/EUR Spread (Coinbase vs Bitstamp)", diff: "+0.85%" },
        { name: "SOL/USDT Opportunity (Bybit vs OKX)", diff: "+2.10%" },
        { name: "XRP/USD Inefficiency (Kraken vs Gemini)", diff: "+0.45%" }
      ],
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  },
};
