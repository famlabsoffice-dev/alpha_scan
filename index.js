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
      // Wir scannen jetzt tiefer (limit=150)
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
    // Preis bei Poly (Outcome 0 ist oft 'Yes')
    const pPrice = p.outcomePrices ? parseFloat(p.outcomePrices[0]) : null;

    kals.forEach(k => {
      const kTitle = (k.title || "").toLowerCase();
      // Kalshi Preise sind oft in Cents (z.B. 45 = 0.45$)
      const kPrice = k.last_price ? k.last_price / 100 : null;

      // Smart-Matching Logik
      const keywords = ["bitcoin", "btc", "fed", "rate", "election", "trump", "biden", "crypto", "ai"];
      const foundKey = keywords.find(word => pTitle.includes(word) && kTitle.includes(word));

      if (foundKey && pPrice && kPrice) {
        const diff = Math.abs(pPrice - kPrice) * 100;
        
        // Nur anzeigen, wenn der Preisunterschied > 2% ist
        if (diff > 2) {
          opportunities.push({
            event: p.question,
            platforms: ["Polymarket", "Kalshi"],
            potential: `PROFIT: ${diff.toFixed(1)}%`,
            details: `Poly: ${pPrice.toFixed(2)}$ | Kals: ${kPrice.toFixed(2)}$`
          });
        }
      }
    });
  });

  return opportunities;
}
