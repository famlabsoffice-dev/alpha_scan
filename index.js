export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const apiOptions = { headers: { "User-Agent": "AlphaScan/1.1" } };
      
      // Limit auf 50 setzen, um Memory-Fehler zu vermeiden
      const [pRes, kRes] = await Promise.all([
        fetch("https://gamma-api.polymarket.com/markets?closed=false&limit=50", apiOptions).catch(() => null),
        fetch("https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=50", apiOptions).catch(() => null)
      ]);

      const poly = (pRes && pRes.ok) ? await pRes.json() : [];
      const kData = (kRes && kRes.ok) ? await kRes.json() : { markets: [] };
      const kMarkets = kData.markets || [];

      const matches = [];

      // Effizientes Matching
      if (Array.isArray(poly) && kMarkets.length > 0) {
        for (const pm of poly) {
          const pTitle = (pm.question || "").toLowerCase();
          if (!pm.outcomePrices || !pm.outcomePrices[0]) continue;
          
          const pPrice = parseFloat(pm.outcomePrices[0]);

          for (const km of kMarkets) {
            const kTitle = (km.title || "").toLowerCase();
            const kPrice = km.last_price ? km.last_price / 100 : null;

            if (pPrice && kPrice) {
              const keywords = pTitle.split(" ").filter(w => w.length > 6);
              const hits = keywords.filter(w => kTitle.includes(w)).length;

              if (hits >= 2) {
                const diff = Math.abs(pPrice - kPrice) * 100;
                if (diff > 0.4) {
                  matches.push({
                    event: pm.question.substring(0, 50),
                    potential: diff.toFixed(1) + "%",
                    platforms: ["Poly", "Kalshi"],
                    details: `P: ${pPrice.toFixed(2)} | K: ${kPrice.toFixed(2)}`
                  });
                }
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({
        opportunities: {
          poly_count: poly.length,
          kals_count: kMarkets.length,
          matches: matches.slice(0, 10) // Nur Top 10 senden
        }
      }), { status: 200, headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: "Memory/Buffer Error: " + err.message }), { 
        status: 200, // Wir senden 200, damit das Frontend die Fehlermeldung lesen kann
        headers: corsHeaders 
      });
    }
  }
};
