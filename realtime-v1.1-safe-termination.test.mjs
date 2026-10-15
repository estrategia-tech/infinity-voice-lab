import test from "node:test";
import assert from "node:assert/strict";
import {safeTerminateBoundCall} from "./realtime-v1.1-safe-termination.mjs";
const reservationId="12345678-1234-4234-8234-123456789abc",callId="rtc_12345678";
const token="synthetic-internal-release-token-0123456789";
function harness({storedCallId=callId,status="pending",available=true,ack=true}={}){
 let hangups=0,releases=0,claims=0,aborts=0;
 const ledgerStub={fetch:async request=>{
  if(new URL(request.url).pathname==="/internal/status")
   return available?Response.json({reservations:[{reservationId,callId:storedCallId,status}]}):
    Response.json({error:"unavailable"},{status:503});
  releases++;
  if(request.headers.get("x-internal-release-token")!==token)
   return Response.json({error:"release_unauthorized"},{status:403});
  return Response.json({released:true});
 }};
 const options={reservationId,callId,ledgerStub,releaseToken:token,
  apiKey:"synthetic-provider-key-0123456789",providerEnabled:true,
  transport:async()=>{hangups++;return {ok:ack,status:ack?200:503}}};
 return {options,get hangups(){return hangups},get releases(){return releases},get claims(){return claims},get aborts(){return aborts}};
}
test("mismatched call never invokes hangup or release",async()=>{
 const h=harness({storedCallId:"rtc_different123"});
 const r=await safeTerminateBoundCall(h.options);
 assert.equal(r.error,"binding_mismatch");assert.equal(h.hangups,0);assert.equal(h.releases,0);
});
test("ledger outage never invokes provider",async()=>{
 const h=harness({available:false});
 const r=await safeTerminateBoundCall(h.options);
 assert.equal(r.error,"binding_unverified");assert.equal(h.hangups,0);assert.equal(h.releases,0);
});
test("invalid state never invokes provider",async()=>{
 const h=harness({status:"unbound"});
 const r=await safeTerminateBoundCall(h.options);
 assert.equal(r.error,"binding_invalid_state");assert.equal(h.hangups,0);
});
test("confirmed binding allows mocked hangup then capability release",async()=>{
 const h=harness();
 const r=await safeTerminateBoundCall(h.options);
 assert.equal(r.ok,true);assert.equal(h.hangups,1);assert.equal(h.releases,1);
});
test("provider failure never releases",async()=>{
 const h=harness({ack:false});
 const r=await safeTerminateBoundCall(h.options);
 assert.equal(r.ok,false);assert.equal(h.hangups,1);assert.equal(h.releases,0);assert.equal(h.aborts,1);
});
test("disabled provider does not hangup even after preflight",async()=>{
 const h=harness();
 const r=await safeTerminateBoundCall({...h.options,providerEnabled:false});
 assert.equal(r.status,403);assert.equal(h.hangups,0);assert.equal(h.releases,0);
});

test("atomic claim is required before hangup and refuses concurrent termination",async()=>{
 let calls=0;
 const ledgerStub={fetch:async req=>{
  const path=new URL(req.url).pathname;
  if(path==="/internal/status")return Response.json({reservations:[{reservationId,callId,status:"pending"}]});
  if(path==="/internal/claim-termination")return Response.json({error:"termination_already_claimed"},{status:409});
  calls++;return Response.json({released:true});
 }};
 const result=await safeTerminateBoundCall({reservationId,callId,ledgerStub,releaseToken:token,
  apiKey:"synthetic-provider-key-0123456789",providerEnabled:true,
  transport:async()=>{calls++;return {ok:true}}});
 assert.equal(result.status,409);assert.equal(calls,0);
});
