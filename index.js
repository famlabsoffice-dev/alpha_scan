export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers'),
        },
      });
    }

    let arbitrageResults = [];

    // --- Manifold Markets --- (Öffentliche API, keine Authentifizierung erforderlich)
    try {
      const manifoldResponse = await fetch('https://api.manifold.markets/v0/markets?limit=5'); // Holt die 5 neuesten Märkte
      const manifoldData = await manifoldResponse.json();
      manifoldData.forEach(market => {
        if (market.probability !== undefined) {
          const price = (market.probability * 100).toFixed(2); // Wahrscheinlichkeit in Prozent umrechnen
          arbitrageResults.push({
            platform: 'Manifold Markets',
            name: market.question,
            price: `${price}%`,
            url: market.url
          });
        }
      });
    } catch (error) {
      console.error('Fehler beim Abrufen von Manifold Markets:', error);
      arbitrageResults.push({ platform: 'Manifold Markets', name: 'Fehler beim Abrufen der Daten', price: 'N/A', url: '#' });
    }

    // --- Polymarket --- (Benötigt spezifischere Endpunkte für Preise oder Aggregation über Jupiter)
    // Für Polymarket gibt es die Gamma API für Marktdaten. Eine direkte Abfrage hierfür ist komplexer, da man spezifische Märkte identifizieren muss.
    // Eine einfachere Integration wäre über Jupiter Predict, wenn ein API-Key vorhanden ist.
    arbitrageResults.push({ platform: 'Polymarket', name: 'Integration ausstehend (API-Key/spezifischer Endpunkt benötigt)', price: 'N/A', url: '#' });

    // --- Jupiter Predict --- (Benötigt API Key)
    // Um Jupiter Predict zu nutzen, müssen Sie einen API-Key in Ihren Cloudflare Worker Umgebungsvariablen hinterlegen.
    // Beispiel: env.JUPITER_API_KEY
    if (env.JUPITER_API_KEY) {
      try {
        const jupiterResponse = await fetch('https://api.jup.ag/prediction/v1/events?provider=polymarket&limit=5', {
          headers: { 'x-api-key': env.JUPITER_API_KEY }
        });
        const jupiterData = await jupiterResponse.json();
        jupiterData.data.forEach(event => {
          event.markets.forEach(market => {
            if (market.pricing && market.pricing.buyYesPriceUsd) {
              const price = (market.pricing.buyYesPriceUsd * 100).toFixed(2);
              arbitrageResults.push({
                platform: 'Jupiter Predict (Polymarket)',
                name: event.metadata.title + ' - ' + market.metadata.title,
                price: `${price}%`,
                url: `https://jup.ag/prediction/${event.eventId}` // Beispiel-URL
              });
            }
          });
        });
      } catch (error) {
        console.error('Fehler beim Abrufen von Jupiter Predict:', error);
        arbitrageResults.push({ platform: 'Jupiter Predict', name: 'Fehler beim Abrufen der Daten (API-Key oder Netzwerk)', price: 'N/A', url: '#' });
      }
    } else {
      arbitrageResults.push({ platform: 'Jupiter Predict', name: 'API Key (JUPITER_API_KEY) fehlt in Umgebungsvariablen', price: 'N/A', url: '#' });
    }

    // --- Kalshi --- (Öffentliche API, keine Authentifizierung erforderlich)
    try {
      const kalshiResponse = await fetch('https://api.elections.kalshi.com/trade-api/v2/markets?limit=5&status=open'); // Holt die 5 neuesten offenen Märkte
      const kalshiData = await kalshiResponse.json();
      kalshiData.markets.forEach(market => {
        if (market.yes_bid && market.no_bid) {
          // Kalshi Preise sind in Cent, umrechnen in Prozent der Wahrscheinlichkeit
          const yesPrice = (market.yes_bid / 100).toFixed(2); // Beispiel: 80 Cents = 0.80
          arbitrageResults.push({
            platform: 'Kalshi',
            name: market.title,
            price: `${yesPrice * 100}% (YES)`,
            url: `https://kalshi.com/markets/${market.ticker}`
          });
        }
      });
    } catch (error) {
      console.error('Fehler beim Abrufen von Kalshi:', error);
      arbitrageResults.push({ platform: 'Kalshi', name: 'Fehler beim Abrufen der Daten', price: 'N/A', url: '#' });
    }

    const responseData = {
      results: arbitrageResults,
      timestamp: new Date().toISOString(),
      status: 'SYSTEM LIVE - Live Data (Manifold, Kalshi) & Placeholder (Jupiter)'
    };

    return new Response(JSON.stringify(responseData), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  },
};
