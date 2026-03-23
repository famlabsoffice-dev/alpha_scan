export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    };

    try {
      const [poly, kals] = await Promise.all([
        fetch("https://gamma-api.polymarket.com/markets?closed=false&limit=150").then(r => r.json()),
        fetch("https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=150").then(r => r.json())
      ]);

      const markets = kals.markets || [];
      const matches = [];

      // RADIKALE SUCHE: Wir zeigen ALLES an, was sich auch nur ähnelt
      poly.forEach(p => {
        const pTitle = (p.question || "").toLowerCase();
        
        markets.forEach(k => {
          const kTitle = (k.title || "").toLowerCase();
          
          // Wir suchen nach EINEM gemeinsamen Wort (länger als 5 Buchstaben)
          const pWords = pTitle.split(" ").filter(w => w.length > 5);
          const hasMatch = pWords.some(word => kTitle.includes(word));

          if (hasMatch) {
            matches.push({
              event: p.question.substring(0, 50),
              platforms: ["Poly", "Kals"],
              potential: "MATCH GEFUNDEN",
              details: `Suche Preisdaten für: ${pWords.filter(w => kTitle.includes(w))[0]}`
            });
          }
        });
      });

      return new Response(JSON.stringify({
        opportunities: { poly_count: poly.length, kals_count: markets.length, matches: matches }
      }), { headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders });
    }
  }
};
