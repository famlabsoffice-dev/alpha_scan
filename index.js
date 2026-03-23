export default {
  async fetch(request, env, ctx) {
    // 1. Sicherheit zuerst: Falls was schiefgeht, Seite nicht killen
    ctx.passThroughOnException();

    const h = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    };

    try {
      // 2. Daten-Abruf (Wir definieren die Logik erst hier drin, um Startup-CPU zu sparen)
      const getJson = async (url) => {
        const r = await fetch(url, { cf: { cacheTtl: 30 } }); // Nutzt Cloudflares Edge Cache
        return r.ok ? await r.json() : null;
      };

      const [p, k, m] = await Promise.all([
        getJson("https://gamma-api.polymarket.com/markets?closed=false&limit=150"),
        getJson("https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=150"),
        getJson("https://api.manifold.markets/v0/markets?limit=150")
      ]);

      const res = [];
      const km = k?.markets || [];

      // 3. Effizientes Matching
      if (p && km.length > 0) {
        for (const pm of p) {
          const pt = (pm.question || "").toLowerCase();
          const pp = pm.outcomePrices ? parseFloat(pm.outcomePrices[0]) : null;
          
          if (!pp) continue;

          for (const kmm of km) {
            const kt = (kmm.title || "").toLowerCase();
            const kp = kmm.last_price ? kmm.last_price / 100 : null;

            if (kp && pt.split(" ").filter(w => w.length > 5).some(w => kt.includes(w))) {
              const d = Math.abs(pp - kp) * 100;
              if (d > 0.5) {
                res.push({
                  event: pm.question.slice(0, 55),
                  potential: d.toFixed(1) + "%",
                  details: `P: ${pp.toFixed(2)}$ | K: ${kp.toFixed(2)}$`
                });
              }
            }
          }
        }
      }

      // 4. Response generieren
      const out = JSON.stringify({
        opportunities: {
          poly: p?.length || 0,
          kals: km.length,
          mani: Array.isArray(m) ? m.length : 0,
          matches: res.sort((a, b) => parseFloat(b.potential) - parseFloat(a.potential))
        }
      });

      return new Response(out, { headers: h });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: h });
    }
  }
};
