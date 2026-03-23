export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const [poly, kals, mani] = await Promise.all([
        fetch("https://gamma-api.polymarket.com/markets?closed=false&limit=150&order=liquidity&ascending=false").then(r => r.json()),
        fetch("https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=150").then(r => r.json()),
        fetch("https://api.manifold.markets/v0/markets?limit=150").then(r => r.json())
      ]);

      const matches = findArbitrage(poly, kals.markets || [], mani);

      return new Response(JSON.stringify({
        opportunities: {
          poly_count: poly.length || 0,
          kals_count: kals.markets?.length || 0,
          mani_count: mani.length || 0,
          matches: matches
        }
      }), { headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};

function findArbitrage(poly, kals, mani) {
  const opportunities = [];
  
  poly.forEach(p => {
    const pTitle = (p.question || "").toLowerCase();
    const pPrice = p.outcomePrices ? parseFloat(p.outcomePrices[0]) : null;

    kals.forEach(k => {
      const kTitle = (k.title || "").toLowerCase();
      const kPrice = k.last_price ? k.last_price / 100 : null;

      const commonWords = ["will", "the", "price", "above", "below", "march", "2026", "2025"];
      const pWords = pTitle.split(" ").filter(w => w.length > 3 && !commonWords.includes(w));
      const matchLevel = pWords.filter(word => kTitle.includes(word)).length;

      if (matchLevel >= 1 && pPrice && kPrice) {
        const diff = Math.abs(pPrice - kPrice) * 100;
        if (diff > 0.5) {
          opportunities.push({
            event: p.question.substring(0, 60) + "...",
            platforms: ["Polymarket", "Kalshi"],
            potential: `DIFF: ${diff.toFixed(1)}%`,
            details: `P: ${pPrice.toFixed(2)}$ | K: ${kPrice.toFixed(2)}$ | Match-Power: ${matchLevel}`
          });
        }
      }
    });
  });

  return opportunities;
}
