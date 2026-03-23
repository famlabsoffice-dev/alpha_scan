export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    // Preflight-Anfrage für Browser
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      // Daten von allen drei Plattformen gleichzeitig abrufen
      const [poly, kals, mani] = await Promise.all([
        fetch("https://gamma-api.polymarket.com/markets?closed=false&limit=50&order=liquidity&ascending=false").then(r => r.json()),
        fetch("https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=50").then(r => r.json()),
        fetch("https://api.manifold.markets/v0/markets?limit=50").then(r => r.json())
      ]);

      const results = {
        poly_count: Array.isArray(poly) ? poly.length : 0,
        kals_count: kals.markets ? kals.markets.length : 0,
        mani_count: Array.isArray(mani) ? mani.length : 0,
        matches: [] // Hier kommt in der nächsten Version die Matching-Logik rein
      };

      return new Response(JSON.stringify({ opportunities: results }), { headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};
