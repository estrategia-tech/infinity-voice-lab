import test from "node:test";
import assert from "node:assert/strict";
import {reconcileLabState} from "./realtime-v1.1-reconciliation.mjs";
const id="12345678-1234-4234-8234-123456789abc",callId="rtc_12345678";
const stub=body=>({fetch:async()=>Response.json(body)});
const reservation=(overrides={})=>({reservationId:id,callId,expiresAt:100,...overrides});
const run=(r,b,now=200)=>reconcileLabState({ledgerStub:stub({reservations:r}),alarmStub:stub({binding:b}),now});
test("mock success is never provider proof or permission to release",async()=>{
 const x=await run([reservation()],{reservationId:id,callId,status:"mock_terminated"});
 assert.equal(x.ok,true);assert.equal(x.results[0].status,"mock_termination_not_provider_proof");
 assert.equal(x.providerVerified,false);assert.equal(x.autoReleased,false);
 assert.equal(x.requiresReview,true);
});
test("missing alarm binding flags unresolved provider call",async()=>{
 const x=await run([reservation()],null);
 assert.equal(x.results[0].status,"alarm_binding_missing_or_mismatched");
 assert.equal(x.requiresReview,true);
});
test("failed alarm and orphan binding require operator review",async()=>{
 const failed=await run([reservation()],{reservationId:id,callId,status:"mock_termination_failed"});
 assert.equal(failed.results[0].status,"mock_termination_failed");
 const orphan=await run([],{reservationId:id,callId,status:"mock_terminated"});
 assert.equal(orphan.orphanAlarm,true);assert.equal(orphan.requiresReview,true);
});
test("expired reservation cannot be considered released",async()=>{
 const x=await run([reservation()],{reservationId:id,callId,status:"pending"});
 assert.equal(x.results[0].status,"expired_unverified");
 assert.equal(x.autoReleased,false);
});
test("missing storage or malformed response fails closed",async()=>{
 const x=await reconcileLabState({ledgerStub:null,alarmStub:stub({binding:null})});
 assert.equal(x.ok,false);assert.equal(x.requiresReview,true);
 const y=await reconcileLabState({ledgerStub:stub({reservations:{}}),alarmStub:stub({binding:null})});
 assert.equal(y.ok,false);
});
test("pending nonexpired binding does not claim provider verification",async()=>{
 const x=await run([reservation({expiresAt:300})],{reservationId:id,callId,status:"pending"});
 assert.equal(x.requiresReview,false);assert.equal(x.providerVerified,false);
});

test("same-DO alarm failures and expiration take precedence over separate mock",async()=>{
 const mock={reservationId:id,callId,status:"mock_terminated"};
 const schedule=await run([reservation({status:"alarm_schedule_failed"})],mock);
 assert.equal(schedule.results[0].status,"alarm_schedule_failed");
 assert.equal(schedule.autoReleased,false);
 const expired=await run([reservation({status:"expired_unterminated"})],mock);
 assert.equal(expired.results[0].status,"expired_unterminated");
 assert.equal(expired.requiresReview,true);
});
