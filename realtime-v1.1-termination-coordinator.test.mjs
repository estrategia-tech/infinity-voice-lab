import test from "node:test";
import assert from "node:assert/strict";
import {terminateAndRelease} from "./realtime-v1.1-termination-coordinator.mjs";
const id="12345678-1234-4234-8234-123456789abc",callId="rtc_12345678",apiKey="synthetic-key-0000000000000";
const ledger=()=>{let releases=0;return {get releases(){return releases},async fetch(){releases++;return Response.json({released:true})}}};
const opts=l=>({callId,reservationId:id,claimId:"synthetic-exclusive-claim-012345",apiKey,ledgerStub:l,transport:async()=>({ok:true,status:200})});
test("default disabled never calls provider or releases",async()=>{
 const l=ledger();let calls=0;
 const x=await terminateAndRelease({...opts(l),transport:async()=>{calls++;return {ok:true}}});
 assert.equal(x.status,403);assert.equal(calls,0);assert.equal(l.releases,0);
});
test("provider failure preserves reservation",async()=>{
 const l=ledger();const x=await terminateAndRelease({...opts(l),providerEnabled:true,transport:async()=>({ok:false,status:500})});
 assert.equal(x.ok,false);assert.equal(l.releases,0);
});
test("provider acknowledgement permits confirmed release",async()=>{
 const l=ledger();const x=await terminateAndRelease({...opts(l),providerEnabled:true});
 assert.equal(x.ok,true);assert.equal(l.releases,1);
});
test("release refusal remains unconfirmed",async()=>{
 const l={fetch:async()=>Response.json({released:false})};
 const x=await terminateAndRelease({...opts(l),providerEnabled:true});
 assert.equal(x.ok,false);assert.equal(x.error,"release_unconfirmed");assert.equal(x.providerAcknowledged,true);
});
test("invalid reservation never calls provider",async()=>{
 let calls=0;const l=ledger();
 const x=await terminateAndRelease({...opts(l),reservationId:"bad",providerEnabled:true,transport:async()=>{calls++;return {ok:true}}});
 assert.equal(x.status,400);assert.equal(calls,0);
});

test("missing exclusive claim prevents provider hangup",async()=>{
 let calls=0;const l=ledger();
 const x=await terminateAndRelease({...opts(l),claimId:undefined,providerEnabled:true,transport:async()=>{calls++;return {ok:true}}});
 assert.equal(x.status,409);assert.equal(x.error,"termination_claim_required");assert.equal(calls,0);assert.equal(l.releases,0);
});
