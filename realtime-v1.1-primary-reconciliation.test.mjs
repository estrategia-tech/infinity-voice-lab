import test from "node:test";
import assert from "node:assert/strict";
import {reconcilePrimaryLedger} from "./realtime-v1.1-primary-reconciliation.mjs";
const id="12345678-1234-4234-8234-123456789abc",callId="rtc_12345678";
const run=(reservations,now=200)=>reconcilePrimaryLedger({
 ledgerStub:{fetch:async()=>Response.json({reservations})},now
});
const reservation=(overrides={})=>({reservationId:id,callId,expiresAt:100,status:"pending",...overrides});
test("primary expiry requires review and never auto-releases",async()=>{
 const x=await run([reservation({status:"expired_unterminated"})]);
 assert.equal(x.ok,true);assert.equal(x.results[0].status,"expired_unterminated");
 assert.equal(x.autoReleased,false);assert.equal(x.providerVerified,false);
 assert.equal(x.requiresReview,true);
});
test("alarm scheduling failure blocks review regardless of expiry",async()=>{
 const x=await run([reservation({status:"alarm_schedule_failed",expiresAt:300})]);
 assert.equal(x.results[0].status,"alarm_schedule_failed");
 assert.equal(x.requiresReview,true);
});
test("expired unbound reservation is not assumed safe",async()=>{
 const x=await run([reservation({callId:null,status:"unbound"})]);
 assert.equal(x.results[0].status,"expired_unbound");
 assert.equal(x.requiresReview,true);
});
test("pending future call does not claim provider termination",async()=>{
 const x=await run([reservation({expiresAt:300})]);
 assert.equal(x.results[0].status,"pending");
 assert.equal(x.requiresReview,false);
 assert.equal(x.providerVerified,false);
});
test("unexpected status, duplicate ID and missing DO fail closed",async()=>{
 const unexpected=await run([reservation({status:"unknown",expiresAt:300})]);
 assert.equal(unexpected.results[0].status,"unknown_binding_state");
 const duplicate=await run([reservation(),reservation()]);
 assert.equal(duplicate.ok,false);assert.equal(duplicate.requiresReview,true);
 const unavailable=await reconcilePrimaryLedger();
 assert.equal(unavailable.ok,false);
});
