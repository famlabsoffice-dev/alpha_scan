export default {
  async fetch(request, env, ctx) {
    // 1. Header-Definition
    const myHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    // 2. CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: myHeaders });
    }

    try {
      // 3. API Fetching (Einzeln zugewiesen, um Declaration Errors zu vermeiden)
      const pRes = await fetch("https://gamma-api.polymarket.com/markets?closed=false&limit=100").catch(() => null);
      const kRes = await fetch("https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=100").catch(() => null);
      const mRes = await fetch("https://api.manifold.markets/v0/markets?limit=100").catch(() => null);

      // 4. JSON Parsing mit Fallbacks
      const p = (pRes && pRes.ok) ? await pRes.json().catch(() => []) : [];
      const kData = (kRes && kRes.ok) ? await kRes.json().catch(() => ({ markets: [] })) : { markets: [] };
      const m = (mRes && mRes.ok) ? await mRes.json().catch(() => []) : [];

      const kMarkets = kData.markets || [];
      const matches = [];

      // 5. Matching Logik
      if (Array.isArray(p) && kMarkets.length > 0) {
        for (let i = 0; i < p.length; i++) {
          const pm = p[i];
          const pTitle = (pm.question || "").toLowerCase();
          
          if (!pm.outcomePrices || pm.outcomePrices.length === 0) continue;
          const pPrice = parseFloat(pm.outcomePrices[0]);

          for (let j = 0; j < kMarkets.length; j++) {
            const km = kMarkets[j];
            const kTitle = (km.title || "").toLowerCase();
            const kPrice = km.last_price ? km.last_price / 100 : null;

            if (pPrice && kPrice) {
              // Einfacher Keyword-Check
              const keywords = pTitle.split(" ").filter(w => w.length > 5);
              let hits = 0;
              for (const word of keywords) {
                if (kTitle.includes(word)) hits++;
              }

              if (hits >= 2) {
                const diff = Math.abs(pPrice - kPrice) * 100;
                if (diff > 0.5) {
                  matches.push({
                    event: pTitle.substring(0, 50),
                    potential: diff.toFixed(1) + "%",
                    details: `P: ${pPrice.toFixed(2)} | K: ${kPrice.toFixed(2)}`
                  });
                }
              }
            }
          }
        }
      }

      // 6. Response
      const result = {
        poly_count: p.length,
        kals_count: kMarkets.length,
        mani_count: Array.isArray(m) ? m.length : 0,
        matches: matches,
        ts: "2026-03-23"
      };

      return new Response(JSON.stringify(result), { 
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
