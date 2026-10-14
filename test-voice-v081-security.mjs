import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './infinity-voice-v081-security.mjs';
const TOKEN='synthetic-local-lab-token-12345678901234567890';
const origin='https://estrategia-tech.github.io';
const quota={idFromName:()=>({}),get:()=>({fetch:async()=>new Response('{"allowed":true}',{status:200})})};
const env={LAB_ACCESS_TOKEN:TOKEN,VOICE_QUOTA:quota};
function call(path='/api/chat', options={}, bindings=env){return worker.fetch(new Request('https://lab.invalid'+path,options),bindings)}
const valid={method:'POST',headers:{Origin:origin,Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'},body:JSON.stringify({message:'Hola'})};
test('health public and AI disabled',async()=>{const r=await call('/health');assert.equal(r.status,200);assert.equal((await r.json()).ai_enabled,false)});
test('no secret configured fails closed',async()=>{const r=await call('/api/chat',valid,{});assert.equal(r.status,503)});
test('unauthorized rejected',async()=>{const r=await call('/api/chat',{...valid,headers:{Origin:origin,'Content-Type':'application/json'},body:valid.body});assert.equal(r.status,401)});
test('bad origin rejected',async()=>{const r=await call('/api/chat',{...valid,headers:{...valid.headers,Origin:'https://evil.invalid'}});assert.equal(r.status,403)});
test('missing quota binding fails closed',async()=>{const r=await call('/api/chat',valid,{LAB_ACCESS_TOKEN:TOKEN});assert.equal(r.status,503)});
test('valid authorized request still cannot call OpenAI',async()=>{const r=await call('/api/chat',valid);assert.equal(r.status,403);assert.equal((await r.json()).error,'ai_disabled')});
test('invalid input rejected',async()=>{const r=await call('/api/chat',{...valid,body:JSON.stringify({message:'x'.repeat(501)})});assert.equal(r.status,400)});
test('cross-origin preflight denied',async()=>{const r=await call('/api/chat',{method:'OPTIONS',headers:{Origin:'https://evil.invalid'}});assert.equal(r.status,403)});
test('no credentials returned',async()=>{const r=await call('/api/chat',valid);assert.doesNotMatch(await r.text(),/synthetic-local-lab-token|sk-/)});
