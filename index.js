export default {
  async fetch(request, env, ctx) {
    // 1. CORS-Header definieren (Erlaubt den Zugriff von Ihrer GitHub-Seite)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', 
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
    };

    // 2. Vorab-Anfrage (OPTIONS) für CORS abfangen
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers'),
        },
      });
    }

    // 3. Ihre Arbitrage-Daten (Hier kommen Ihre Scan-Ergebnisse rein)
    const data = {
      results: [
        { name: "BTC/USDT Arbitrage (Binance vs Kraken)", diff: "+1.25%" },
        { name: "ETH/EUR Spread (Coinbase vs Bitstamp)", diff: "+0.85%" },
        { name: "SOL/USDT Opportunity (Bybit vs OKX)", diff: "+2.10%" },
        { name: "XRP/USD Inefficiency (Kraken vs Gemini)", diff: "+0.45%" }
      ],
      timestamp: new Date().toISOString(),
      status: "SYSTEM LIVE"
    };

    // 4. Die Antwort als echtes JSON zurückgeben
    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      }
    });
  },
};
