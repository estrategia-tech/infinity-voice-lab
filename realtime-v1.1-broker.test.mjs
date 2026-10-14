import test from "node:test";
import assert from "node:assert/strict";
import broker from "./realtime-v1.1-broker-candidate.mjs";
const env={LAB_ALLOWED_ORIGIN:"https://estrategia-tech.github.io",LAB_ACCESS_TOKEN:"x".repeat(40)};
const call=(path,method="POST",options={})=>broker.fetch(new Request("https://lab.invalid"+path,{method,headers:options.headers||{}}),options.env||{});
test("health explicitly disabled",async()=>{const r=await call("/health","GET");assert.equal(r.status,200);assert.equal((await r.json()).realtime_enabled,false)});
test("missing lab configuration denies without access",async()=>{const r=await call("/api/realtime/session");assert.equal(r.status,503);assert.equal((await r.json()).error,"lab_not_configured")});
test("invalid origin is forbidden",async()=>{const r=await call("/api/realtime/session","POST",{env,headers:{Origin:"https://evil.invalid",Authorization:"Bearer "+env.LAB_ACCESS_TOKEN}});assert.equal(r.status,403);assert.equal((await r.json()).error,"origin_denied")});
test("missing bearer is unauthorized",async()=>{const r=await call("/api/realtime/session","POST",{env,headers:{Origin:env.LAB_ALLOWED_ORIGIN}});assert.equal(r.status,401)});
test("valid authorization still cannot mint or reserve",async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error("Unexpected outbound call")};
 try{
  const r=await call("/api/realtime/session","POST",{env:{...env,REALTIME_ENABLED:"true",OPENAI_API_KEY:"fake",LAB_LEDGER:{get:()=>{throw Error("No quota consumption allowed")}}},headers:{Origin:env.LAB_ALLOWED_ORIGIN,Authorization:"Bearer "+env.LAB_ACCESS_TOKEN}});
  assert.equal(r.status,403);assert.equal((await r.json()).error,"realtime_disabled");assert.equal(calls,0);assert.equal(r.headers.get("cache-control"),"no-store");
 }finally{globalThis.fetch=original}
});
test("unknown routes return 404",async()=>assert.equal((await call("/unknown")).status,404));
test("session GET rejected",async()=>assert.equal((await call("/api/realtime/session","GET")).status,405));
