export default {
  async fetch(request, env, ctx) {
    const myHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: myHeaders });
    }

    try {
      // Fetching mit User-Agent (wichtig für 2026er API-Stabilität)
      const fOpts = { headers: { "User-Agent": "AlphaScan/1.1" } };
      
      const [pRes, kRes, mRes] = await Promise.all([
        fetch("https://gamma-api.polymarket.com/markets?closed=false&limit=100", fOpts).catch(() => null),
        fetch("https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=100", fOpts).catch(() => null),
        fetch("https://api.manifold.markets/v0/markets?limit=100", fOpts).catch(() => null)
      ]);

      const p = (pRes && pRes.ok) ? await pRes.json().catch(() => []) : [];
      const kData = (kRes && kRes.ok) ? await kRes.json().catch(() => ({ markets: [] })) : { markets: [] };
      const m = (mRes && mRes.ok) ? await mRes.json().catch(() => []) : [];

      const kMarkets = kData.markets || [];
      const matches = [];

      if (Array.isArray(p) && kMarkets.length > 0) {
        p.forEach(pm => {
          const pTitle = (pm.question || "").toLowerCase();
          if (!pm.outcomePrices || pm.outcomePrices.length === 0) return;
          const pPrice = parseFloat(pm.outcomePrices[0]);

          kMarkets.forEach(km => {
            const kTitle = (km.title || "").toLowerCase();
            const kPrice = km.last_price ? km.last_price / 100 : null;

            if (pPrice && kPrice) {
              const keywords = pTitle.split(" ").filter(w => w.length > 5);
              const hits = keywords.filter(w => kTitle.includes(w)).length;

              if (hits >= 2) {
                const diff = Math.abs(pPrice - kPrice) * 100;
                if (diff > 0.5) {
                  matches.push({
                    event: pm.question.substring(0, 60),
                    potential: diff.toFixed(1) + "%",
                    platforms: ["Polymarket", "Kalshi"], // WICHTIG für dein Frontend
                    details: `P: ${pPrice.toFixed(2)} | K: ${kPrice.toFixed(2)}`
                  });
                }
              }
            }
          });
        });
      }

      // WICHTIG: Die Antwort muss in "opportunities" gewrappt sein!
      const finalResponse = {
        opportunities: {
          poly_count: p.length,
          kals_count: kMarkets.length,
          mani_count: Array.isArray(m) ? m.length : 0,
          matches: matches
        }
      };

      return new Response(JSON.stringify(finalResponse), { 
        status: 200, 
        headers: myHeaders 
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: myHeaders 
      });
    }
  }
};
