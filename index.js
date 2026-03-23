// Ändere nur die findArbitrage Funktion am Ende deiner index.js:

function findArbitrage(poly, kals, mani) {
  const opportunities = [];
  
  poly.forEach(p => {
    const pTitle = (p.question || "").toLowerCase();
    const pPrice = p.outcomePrices ? parseFloat(p.outcomePrices[0]) : null;

    kals.forEach(k => {
      const kTitle = (k.title || "").toLowerCase();
      const kPrice = k.last_price ? k.last_price / 100 : null;

      // Wir erweitern die Wortsuche massiv
      const commonWords = ["will", "the", "price", "above", "below", "march", "2026", "2025"];
      const pWords = pTitle.split(" ").filter(w => w.length > 3 && !commonWords.includes(w));
      const matchLevel = pWords.filter(word => kTitle.includes(word)).length;

      // Wenn mindestens 1 wichtiges Wort matcht UND Preise da sind
      if (matchLevel >= 1 && pPrice && kPrice) {
        const diff = Math.abs(pPrice - kPrice) * 100;
        
        // Wir senken die Hürde auf 0.5%, nur um zu sehen, dass es klappt!
        if (diff > 0.5) {
          opportunities.push({
            event: p.question.substring(0, 60) + "...",
            platforms: ["Polymarket", "Kalshi"],
            potential: `DIFF: ${diff.toFixed(1)}%`,
            details: `P: ${pPrice.toFixed(2)}$ | K: ${kPrice.toFixed(2)}$ | Match-Power: ${matchLevel}`
          });
        }
      }
    });
  });

  return opportunities;
}
