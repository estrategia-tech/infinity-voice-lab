import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './infinity-voice-v08-worker-candidate.mjs';

const call = (path, method='GET', env={}) => worker.fetch(new Request(`https://lab.invalid${path}`, {method}), env);
const body = async r => ({status:r.status, json:await r.json()});

test('health describes disabled laboratory', async () => {
  const r=await body(await call('/health'));
  assert.equal(r.status,200);
  assert.equal(r.json.version,'0.8.0-candidate');
  assert.equal(r.json.ai_enabled,false);
});
test('AI remains disabled by default', async () => {
  const r=await body(await call('/api/chat','POST'));
  assert.equal(r.status,403);
  assert.equal(r.json.error,'ai_disabled');
});
test('AI remains blocked even if enable flag is supplied', async () => {
  const r=await body(await call('/api/chat','POST',{VOICE_AI_ENABLED:'true'}));
  assert.equal(r.status,503);
  assert.equal(r.json.error,'security_gate_not_implemented');
});
test('unsupported routes and methods are denied', async () => {
  assert.equal((await call('/openai','POST')).status,404);
  assert.equal((await call('/api/chat','GET')).status,405);
});
test('does not expose credentials or allow cross-origin access', async () => {
  const r=await call('/api/chat','POST',{VOICE_AI_ENABLED:'true',OPENAI_API_KEY:'dummy'});
  assert.equal(r.headers.get('access-control-allow-origin'),null);
  assert.doesNotMatch(await r.text(),/dummy|sk-/);
});
