export default {
  async fetch(request, env) {
    const corsHeaders = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"};
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    try {
      const [poly, kals] = await Promise.all([
        fetch("https://gamma-api.polymarket.com/markets?closed=false&limit=150").then(r => r.json()),
        fetch("https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=150").then(r => r.json())
      ]);
      const matches = [];
      const markets = kals.markets || [];
      poly.forEach(p => {
        const pTitle = (p.question || "").toLowerCase();
        markets.forEach(k => {
          const kTitle = (k.title || "").toLowerCase();
          const pWords = pTitle.split(" ").filter(w => w.length > 5);
          if (pWords.some(word => kTitle.includes(word))) {
            matches.push({event: p.question.substring(0, 50), platforms: ["Poly", "Kals"], potential: "MATCH", details: "Check Prices"});
          }
        });
      });
      return new Response(JSON.stringify({opportunities: {poly_count: poly.length, kals_count: markets.length, matches: matches}}), {headers: corsHeaders});
    } catch (err) {
      return new Response(JSON.stringify({error: err.message}), {headers: corsHeaders});
    }
  }
};
