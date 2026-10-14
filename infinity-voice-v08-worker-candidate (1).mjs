// Infinity Voice Lab v0.8 — isolated candidate. AI calls disabled until explicitly configured.
const VERSION = '0.8.0-candidate';
const MAX_CHARS = 500;
const MAX_OUTPUT_TOKENS = 180;
const reply = (data, status=200) => new Response(JSON.stringify(data), {status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') return reply({service:'infinity-voice-lab',version:VERSION,mode:'laboratory',ai_enabled:false});
    if (url.pathname !== '/api/chat') return reply({error:'not_found'},404);
    if (request.method !== 'POST') return reply({error:'method_not_allowed'},405);
    // Fail closed. No real AI calls or costs in this candidate.
    if (env?.VOICE_AI_ENABLED !== 'true') return reply({error:'ai_disabled',message:'La IA sigue desactivada en este candidato.'},403);
    // Future production-safe auth must be enforced at the edge before allowing this endpoint.
    // Never expose an API key or a shared server token in GitHub Pages / browser code.
    return reply({error:'security_gate_not_implemented',message:'Falta implementar autenticación por sesión, control de cuota y autorización.'},503);
  }
};
