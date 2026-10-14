import test from "node:test";
import assert from "node:assert/strict";
import broker from "./realtime-v1.1-broker-candidate.mjs";
const call=(path,method="POST",env={})=>broker.fetch(new Request("https://lab.invalid"+path,{method}),env);
test("health explicitly disabled",async()=>{const r=await call("/health","GET");assert.equal(r.status,200);assert.equal((await r.json()).realtime_enabled,false)});
test("session creation always fails closed",async()=>{const r=await call("/api/realtime/session");assert.equal(r.status,403);assert.equal((await r.json()).error,"realtime_disabled");assert.equal(r.headers.get("cache-control"),"no-store")});
test("even enabling env variables cannot spend money",async()=>{const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error("Unexpected outbound call")};try{const r=await call("/api/realtime/session","POST",{REALTIME_ENABLED:"true",OPENAI_API_KEY:"fake",LAB_ACCESS_TOKEN:"fake"});assert.equal(r.status,403);assert.equal(calls,0)}finally{globalThis.fetch=original}});
test("unknown routes return 404",async()=>assert.equal((await call("/unknown")).status,404));
test("session GET rejected",async()=>assert.equal((await call("/api/realtime/session","GET")).status,405));
