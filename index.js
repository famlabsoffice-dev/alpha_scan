export default {
  async fetch(request) {
    const h = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    };

    try {
      const r = await fetch("https://gamma-api.polymarket.com/markets?closed=false&limit=10");
      const d = await r.json();
      
      const m = d.map(x => ({
        q: x.question ? x.question.substring(0, 40) : "N/A",
        p: x.outcomePrices ? x.outcomePrices[0] : "0"
      }));

      return new Response(JSON.stringify({ markets: m }), { headers: h });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Retry" }), { headers: h });
    }
  }
};
