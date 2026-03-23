export default {
  async fetch(request) {
    const h = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"};
    try {
      const [pD, kD, mD] = await Promise.all([
        fetch("https://gamma-api.polymarket.com/markets?closed=false&limit=150").then(r => r.json()),
        fetch("https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=150").then(r => r.json()),
        fetch("https://api.manifold.markets/v0/markets?limit=150").then(r => r.json())
      ]);
      const res = [];
      const kM = kD.markets || [];
      pD.forEach(p => {
        const pt = (p.question || "").toLowerCase();
        const pp = p.outcomePrices ? parseFloat(p.outcomePrices[0]) : null;
        kM.forEach(k => {
          const kt = (k.title || "").toLowerCase();
          const kp = k.last_price ? k.last_price / 100 : null;
          if (pp && kp && pt.split(" ").filter(w => w.length > 7).some(w => kt.includes(w))) {
            const d = Math.abs(pp - kp) * 100;
            res.push({event: p.question.slice(0, 50), platforms: ["Poly", "Kals"], potential: d.toFixed(1) + "%", details: `P: ${pp.toFixed(2)}$ | K: ${kp.toFixed(2)}$`});
          }
        });
      });
      return new Response(JSON.stringify({opportunities: {poly_count: pD.length, kals_count: kM.length, mani_count: mD.length, matches: res}}), {headers: h});
    } catch (e) {
      return new Response(JSON.stringify({error: e.message}), {headers: h});
    }
  }
};
