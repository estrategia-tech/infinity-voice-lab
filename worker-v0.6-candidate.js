// Infinity Voice Lab v0.6.0 - offline security candidate. No OpenAI or calls.
const SERVICE = 'infinity-voice-api-lab';
const VERSION = '0.6.0-candidate';
const ORIGIN = 'https://estrategia-tech.github.io';
const encoder = new TextEncoder();

function response(data, status, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Vary': 'Origin',
  };
  if (origin === ORIGIN) headers['Access-Control-Allow-Origin'] = ORIGIN;
  return new Response(JSON.stringify(data), { status, headers });
}

function sameLengthConstantTime(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aa = encoder.encode(a);
  const bb = encoder.encode(b);
  let mismatch = aa.length ^ bb.length;
  const max = Math.max(aa.length, bb.length);
  for (let i = 0; i < max; i++) mismatch |= (aa[i] || 0) ^ (bb[i] || 0);
  return mismatch === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const origin = request.headers.get('Origin');
    const send = (data, status = 200) => response(data, status, origin);

    if (request.method === 'OPTIONS') {
      // No preflight is enabled until a safe browser authentication flow exists.
      return send({ error: 'method_not_allowed' }, 405);
    }
    if (path === '/health') {
      if (request.method !== 'GET') return send({ error: 'method_not_allowed' }, 405);
      return send({ service: SERVICE, version: VERSION, status: 'operational', mode: 'laboratory', openai_sessions_enabled: false });
    }
    if (/(^|\/)(session|sessions|realtime|openai)(\/|$)/i.test(path)) {
      return send({ error: 'sessions_disabled', message: 'Las sesiones de OpenAI permanecen deshabilitadas en este laboratorio.' }, 403);
    }
    if (path === '/security') {
      if (request.method !== 'GET') return send({ error: 'method_not_allowed' }, 405);
      const expected = env?.LAB_ACCESS_TOKEN;
      if (typeof expected !== 'string' || expected.length < 32) {
        return send({ error: 'security_not_configured' }, 503);
      }
      const supplied = request.headers.get('Authorization') || '';
      if (!supplied.startsWith('Bearer ') || !sameLengthConstantTime(supplied.slice(7), expected)) {
        return send({ error: 'unauthorized', message: 'Acceso no autorizado.' }, 401);
      }
      return send({ service: SERVICE, version: VERSION, authenticated: true, openai_sessions_enabled: false });
    }
    return send({ error: 'not_found', message: 'Ruta no encontrada.' }, 404);
  },
};
