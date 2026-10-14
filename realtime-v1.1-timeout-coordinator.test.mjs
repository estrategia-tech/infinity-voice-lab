import test from "node:test";
import assert from "node:assert/strict";
import {createTimeoutBinding,expireBoundCall} from "./realtime-v1.1-timeout-coordinator.mjs";
const reservationId="12345678-1234-4234-8234-123456789abc";
const reservation={reservationId,expiresAt:1800000000000},callId="rtc_12345678";
const binding=createTimeoutBinding({reservation,callId}).binding;
const apiKey="synthetic-key-000000000000000";
test("rejects unbound call identifiers",()=>{
 assert.equal(createTimeoutBinding({reservation,callId:"bad"}).ok,false);
});
test("before deadline cannot hangup or release",async()=>{
 let calls=0;const ledgerStub={fetch:async()=>{calls++;return Response.json({released:true})}};
 const x=await expireBoundCall({binding,now:reservation.expiresAt-1,providerEnabled:true,apiKey,
  transport:async()=>{calls++;return {ok:true}},ledgerStub});
 assert.equal(x.status,409);assert.equal(calls,0);
});
test("expired but provider disabled retains reservation",async()=>{
 let releases=0;const ledgerStub={fetch:async()=>{releases++;return Response.json({released:true})}};
 const x=await expireBoundCall({binding,now:reservation.expiresAt,ledgerStub});
 assert.equal(x.status,403);assert.equal(releases,0);
});
test("expired mock provider acknowledgement releases",async()=>{
 let calls=0;const ledgerStub={fetch:async()=>{calls++;return Response.json({released:true})}};
 const x=await expireBoundCall({binding,now:reservation.expiresAt,providerEnabled:true,apiKey,
  transport:async()=>{calls++;return {ok:true,status:200}},ledgerStub});
 assert.equal(x.ok,true);assert.equal(calls,2);
});
test("expired provider error cannot release",async()=>{
 let releases=0;const ledgerStub={fetch:async()=>{releases++;return Response.json({released:true})}};
 const x=await expireBoundCall({binding,now:reservation.expiresAt,providerEnabled:true,apiKey,
  transport:async()=>({ok:false,status:500}),ledgerStub});
 assert.equal(x.ok,false);assert.equal(releases,0);
});
