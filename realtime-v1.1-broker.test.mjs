import test from "node:test";
import assert from "node:assert/strict";
import broker from "./realtime-v1.1-broker-candidate.mjs";
const call=(path,method="POST")=>broker.fetch(new Request("https://lab.invalid"+path,{method}),{});
test("health is explicitly disabled",async()=>{const r=await call("/health","GET");assert.equal(r.status,200);assert.equal((await r.json()).realtime_enabled,false)});
test("session creation always fails closed",async()=>{const r=await call("/api/realtime/session");assert.equal(r.status,403);assert.equal((await r.json()).error,"realtime_disabled");assert.equal(r.headers.get("cache-control"),"no-store")});
test("unknown routes return 404",async()=>assert.equal((await call("/unknown")).status,404));
test("session GET is rejected",async()=>assert.equal((await call("/api/realtime/session","GET")).status,405));
