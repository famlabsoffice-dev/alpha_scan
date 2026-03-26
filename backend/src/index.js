/**
 * AlphaScan Cloudflare Worker
 * FamilyLaboratories — alphascan.famlabsoffice.workers.dev
 */

const ALLOWED_ORIGINS = [
  'https://famlabsoffice-dev.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
];

function getCORSHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

function corsResponse(body, status = 200, extraHeaders = {}, request) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCORSHeaders(request),
      ...extraHeaders,
    },
  });
}

function b64url(obj) {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function signJWT(payload, secret) {
  const header  = b64url({ alg: 'HS256', typ: 'JWT' });
  const body    = b64url({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 });
  const data    = `${header}.${body}`;
  const key     = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuf  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sig     = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${data}.${sig}`;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const data = `${header}.${payload}`;
    const key  = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid    = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!valid) return null;
    const decoded  = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  return Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: getCORSHeaders(request) });
    }

    // Health Check
    if (url.pathname === '/api/health') {
      return corsResponse(JSON.stringify({ status: 'ok', version: '4.1.0' }), 200, {}, request);
    }

    // Nonce Generator
    if (url.pathname === '/api/nonce') {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      if (env.ALPHASCAN_NONCES) {
        await env.ALPHASCAN_NONCES.put(`nonce:${nonce}`, '1', { expirationTtl: 300 });
      }
      return corsResponse(JSON.stringify({ nonce }), 200, {}, request);
    }

    // SIWE Verify
    if (url.pathname === '/api/siwe-verify' && request.method === 'POST') {
      const { message, signature, address, type } = await request.json();
      
      // Basic validation (structural)
      if (!message || !signature || !address) {
        return corsResponse(JSON.stringify({ valid: false, error: 'Missing fields' }), 400, {}, request);
      }

      // Issue JWT
      const token = await signJWT({ address, type, isPro: true }, env.JWT_SECRET || 'default_secret');
      
      return corsResponse(JSON.stringify({ valid: true, isPro: true }), 200, {
        'Set-Cookie': `session=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=86400`
      }, request);
    }

    // Session Check
    if (url.pathname === '/api/session') {
      const cookies = parseCookies(request);
      const token = cookies.session;
      if (!token) return corsResponse(JSON.stringify({ valid: false }), 200, {}, request);
      
      const decoded = await verifyJWT(token, env.JWT_SECRET || 'default_secret');
      if (!decoded) return corsResponse(JSON.stringify({ valid: false }), 200, {}, request);
      
      return corsResponse(JSON.stringify({ valid: true, address: decoded.address, isPro: decoded.isPro }), 200, {}, request);
    }

    // CORS Proxy (Original functionality)
    const targetUrl = url.searchParams.get('url');
    const auth = url.searchParams.get('auth');

    if (targetUrl) {
      if (auth !== (env.ACCESS_PASSWORD || 'TGMFAM2026')) {
        return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401, {}, request);
      }
      try {
        const res = await fetch(targetUrl);
        const data = await res.text();
        return corsResponse(data, 200, {}, request);
      } catch (e) {
        return corsResponse(JSON.stringify({ error: 'Fetch failed' }), 500, {}, request);
      }
    }

    return corsResponse(JSON.stringify({ error: 'Not found' }), 404, {}, request);
  }
};
