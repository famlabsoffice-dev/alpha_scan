export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const apiOptions = { headers: { "User-Agent": "AlphaScan-Terminal/1.1" } };

      // API Abfragen
      const [pRes, kRes, mRes] = await Promise.all([
        fetch("https://gamma-api.polymarket.com/markets?closed=false&limit=100", apiOptions).catch(() => null),
        fetch("https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=100", apiOptions).catch(() => null),
        fetch("https://api.manifold.markets/v0/markets?limit=100", apiOptions).catch(() => null)
      ]);

      const poly = (pRes && pRes.ok) ? await pRes.json().catch(() => []) : [];
      const kData = (kRes && kRes.ok) ? await kRes.json().catch(() => ({ markets: [] })) : { markets: [] };
      const mani = (mRes && mRes.ok) ? await mRes.json().catch(() => []) : [];

      const kalshiMarkets = kData.markets || [];
      const matches = [];

      // Arbitrage-Logik
      if (Array.isArray(poly) && kalshiMarkets.length > 0) {
        poly.forEach(pm => {
          const pTitle = (pm.question || "").toLowerCase();
          if (!pm.outcomePrices || pm.outcomePrices.length === 0) return;
          const pPrice = parseFloat(pm.outcomePrices[0]);

          kalshiMarkets.forEach(km => {
            const kTitle = (km.title || "").toLowerCase();
            const kPrice = km.last_price ? km.last_price / 100 : null;

            if (pPrice && kPrice) {
              const keywords = pTitle.split(" ").filter(w => w.length > 5);
              const hits = keywords.filter(w => kTitle.includes(w)).length;

              if (hits >= 2) {
                const diff = Math.abs(pPrice - kPrice) * 100;
                if (diff > 0.4) {
                  matches.push({
                    event: pm.question.substring(0, 60),
                    potential: diff.toFixed(1) + "%",
                    platforms: ["Polymarket", "Kalshi"],
                    details: `P: ${pPrice.toFixed(2)} | K: ${kPrice.toFixed(2)}`
                  });
                }
              }
            }
          });
        });
      }

      // Die Antwort, die dein GitHub-Frontend braucht
      const payload = {
        opportunities: {
          poly_count: poly.length,
          kals_count: kalshiMarkets.length,
          mani_count: mani.length,
          matches: matches
        }
      };

      return new Response(JSON.stringify(payload), { status: 200, headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};
