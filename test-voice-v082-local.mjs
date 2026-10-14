import assert from 'node:assert/strict';

const BASE = 'http://127.0.0.1:8789';
const TOKEN = process.env.LAB_ACCESS_TOKEN;
const ORIGIN = 'https://estrategia-tech.github.io';
assert.ok(TOKEN?.length >= 32, 'Synthetic LAB_ACCESS_TOKEN required');

async function request() {
  const response = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: {Origin: ORIGIN, Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({message:'Prueba aislada de cuota'})
  });
  return {status: response.status, data: await response.json()};
}

async function main() {
  const phase = process.argv[2];
  const health = await fetch(`${BASE}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ai_enabled, false);
  if (phase === 'initial') {
    const unauth = await fetch(`${BASE}/api/chat`, {method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:'{"message":"Hola"}'});
    assert.equal(unauth.status, 401);
    for(let i=0;i<5;i++) {
      const r=await request();
      assert.equal(r.status,403,`request ${i+1} must be admitted then blocked from AI`);
      assert.equal(r.data.error,'ai_disabled');
    }
    console.log('PASS: 5 authorized requests admitted; AI disabled');
  } else if (phase === 'persisted') {
    const r=await request();
    assert.equal(r.status,429,'sixth request must be rejected after Wrangler restart');
    assert.equal(r.data.error,'quota_exceeded');
    console.log('PASS: quota persists across Worker restart');
  } else if (phase === 'concurrent') {
    const results=await Promise.all(Array.from({length:10},request));
    assert.equal(results.filter(r=>r.status===403 && r.data.error==='ai_disabled').length,5);
    assert.equal(results.filter(r=>r.status===429 && r.data.error==='quota_exceeded').length,5);
    console.log('PASS: concurrent quota enforces exactly 5 admitted, 5 rejected');
  } else throw new Error('Unknown phase');
}
main().catch(err=>{console.error(err);process.exitCode=1});
