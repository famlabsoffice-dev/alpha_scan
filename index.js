export default {
  async fetch(request, env) {
    // CORS-Header, damit dein GitHub-Frontend zugreifen darf
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    // Preflight-Check für Browser-Sicherheit
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Die API-Endpunkte
    const API_POLY = "https://gamma-api.polymarket.com/markets?closed=false&limit=50&order=liquidity&ascending=false";
    const API_KALS = "https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=50";
    const API_MANI = "https://api.manifold.markets/v0/markets?limit=50";

    try {
      // Alle drei APIs gleichzeitig abrufen (Performance!)
      const [polyRes, kalsRes, maniRes] = await Promise.all([
        fetch(API_POLY).then(r => r.json()),
        fetch(API_KALS).then(r => r.json()),
        fetch(API_MANI).then(r => r.json())
      ]);

      // Matching-Logik ausführen
      const results = analyzeArbitrage(polyRes, kalsRes.markets, maniRes);

      // Daten strukturiert zurückgeben
      return new Response(JSON.stringify({
        timestamp: new Date().toLocaleTimeString(),
        opportunities: results
      }), { headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ 
        error: "FETCH_FAILED", 
        details: err.message 
      }), { status: 500, headers: corsHeaders });
    }
  }
};

/**
 * Kern-Logik: Vergleicht Märkte anhand von Keywords
 */
function analyzeArbitrage(poly, kals, mani) {
  let matches = [];
  
  // Sicherstellen, dass Daten vorhanden sind
  const polyData = Array.isArray(poly) ? poly : [];
  const kalsData = Array.isArray(kals) ? kals : [];
  const maniData = Array.isArray(mani) ? mani : [];

  // Vergleich: Polymarket vs. Kalshi
  polyData.forEach(p => {
    const pTitle = (p.question || "").toLowerCase();
    
    kalsData.forEach(k => {
      const kTitle = (k.title || "").toLowerCase();
      
      // Keywords extrahieren (Wörter länger als 4 Zeichen)
      const keywords = pTitle.split(" ").filter(w => w.length > 4);
      const hits = keywords.filter(word => kTitle.includes(word));
      
      // Wenn mindestens 2 signifikante Wörter übereinstimmen
      if (hits.length >= 2) {
        matches.push({
          event: p.question,
          platforms: ["Polymarket", "Kalshi"],
          potential: "MANUAL_CHECK_PRICES",
          details: `Matching Keywords: ${hits.slice(0, 3).join(", ")}`
        });
      }
    });
  });

  return {
    poly_count: polyData.length,
    kals_count: kalsData.length,
    mani_count: maniData.length,
    matches: matches
  };
}
