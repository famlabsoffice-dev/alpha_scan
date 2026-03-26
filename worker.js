export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers'),
        },
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing target URL' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'AlphaScan-Enterprise-Bot/4.1.0',
          'Accept': 'application/json'
        }
      });
      const data = await response.text();
      
      return new Response(data, {
        headers: corsHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to fetch target URL', details: err.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  },
};
