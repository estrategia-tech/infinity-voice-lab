import test from "node:test";
import assert from "node:assert/strict";
import broker from "./realtime-v1.1-broker-candidate.mjs";
const paths=[
 "/internal/reserve","/internal/release","/internal/bind","/internal/status",
 "/__local/reserve","/__local/release","/__local/bind","/__local/status",
 "/api/realtime/hangup","/api/realtime/release","/api/realtime/bind",
 "/api/realtime/session/../../internal/release"
];
test("public broker does not route internal or test-only endpoints",async()=>{
 for(const path of paths){
  const r=await broker.fetch(new Request("https://lab.example.test"+path,{
   method:"POST",headers:{"authorization":"Bearer forged","x-internal-release-token":"forged"},
   body:"{}"
  }),{});
  assert.equal(r.status,404,path);
  assert.equal((await r.json()).error,"not_found",path);
 }
});
test("public session route remains disabled even with valid synthetic access",async()=>{
 const env={LAB_ALLOWED_ORIGIN:"https://lab.example.test",
  LAB_ACCESS_TOKEN:"synthetic-local-only-token-0123456789abcdef"};
 const r=await broker.fetch(new Request("https://lab.example.test/api/realtime/session",{
  method:"POST",headers:{"origin":env.LAB_ALLOWED_ORIGIN,"authorization":"Bearer "+env.LAB_ACCESS_TOKEN}
 }),env);
 assert.equal(r.status,403);
 assert.equal((await r.json()).error,"realtime_disabled");
});
