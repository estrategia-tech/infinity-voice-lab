import assert from 'node:assert/strict';
import worker from './worker-v0.6-candidate.js';
const base = 'https://infinity-voice-api-lab.example';
const secret = 'abcdefghijklmnopqrstuvwxyz0123456789abcdef';
async function check(path, method, expectedStatus, expectedError, headers = {}, env = {LAB_ACCESS_TOKEN: secret}) {
  const res = await worker.fetch(new Request(base + path, {method, headers}), env);
  assert.equal(res.status, expectedStatus, `${method} ${path}`);
  const body = await res.json();
  if (expectedError) assert.equal(body.error, expectedError);
  return {res,body};
}
const h = await check('/health','GET',200);
assert.equal(h.body.version,'0.6.0-candidate');
assert.equal(h.body.openai_sessions_enabled,false);
await check('/health','POST',405,'method_not_allowed');
await check('/security','GET',401,'unauthorized');
await check('/security','GET',401,'unauthorized',{Authorization:'Bearer wrong'});
const auth = await check('/security','GET',200,null,{Authorization:'Bearer '+secret});
assert.equal(auth.body.authenticated,true);
await check('/security','GET',503,'security_not_configured',{},{});
await check('/session','POST',403,'sessions_disabled');
await check('/openai/realtime','GET',403,'sessions_disabled');
await check('/not-found','GET',404,'not_found');
await check('/health','OPTIONS',405,'method_not_allowed');
const cors = await check('/health','GET',200,null,{Origin:'https://evil.example'});
assert.equal(cors.res.headers.get('Access-Control-Allow-Origin'),null);
const allowed = await check('/health','GET',200,null,{Origin:'https://estrategia-tech.github.io'});
assert.equal(allowed.res.headers.get('Access-Control-Allow-Origin'),'https://estrategia-tech.github.io');
console.log('PASS: 12 pruebas de rutas, autenticación, bloqueo y CORS');
