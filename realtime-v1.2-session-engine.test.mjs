import test from "node:test";
import assert from "node:assert/strict";
import {createOfflineSession,advanceOfflineSession,sessionPublicSnapshot} from "./realtime-v1.2-session-engine.mjs";
const start=()=>createOfflineSession({reservationId:"reservation_test_001",now:100}).session;
const step=(s,event,options={})=>advanceOfflineSession(s,event,{now:s.updatedAt+1,...options});
test("offline lifecycle reaches terminated only with explicit acknowledgement",()=>{
 let s=start();
 for(const [event,options] of [["admit",{}],["offer_accepted",{}],["provider_connected",{callId:"rtc_mock12345"}],["request_termination",{}]]){
  const r=step(s,event,options);assert.equal(r.ok,true);s=r.session;
 }
 assert.equal(s.state,"terminating");
 assert.equal(step(s,"provider_ack").error,"provider_ack_required");
 assert.equal(step(s,"provider_ack",{providerAcknowledged:true}).session.state,"terminated");
 assert.equal(step(s,"provider_unknown").session.state,"termination_unconfirmed");
});
test("uncertain state cannot be released by clock or fabricated event",()=>{
 let s=start();
 for(const [e,o] of [["admit",{}],["offer_accepted",{}],["request_termination",{}],["provider_unknown",{}]]){
  s=step(s,e,o).session;
 }
 assert.equal(step(s,"provider_ack",{providerAcknowledged:true}).error,"transition_denied");
 assert.equal(step(s,"timeout").error,"transition_denied");
 assert.equal(step(s,"review_required").session.state,"termination_unconfirmed");
 assert.equal(sessionPublicSnapshot(s).needsReview,true);
});
test("no skipped steps, no invalid call identifiers, no backward time",()=>{
 const s=start();
 assert.equal(step(s,"provider_connected",{callId:"rtc_valid123"}).ok,false);
 const admitted=step(s,"admit").session;
 const negotiating=step(admitted,"offer_accepted").session;
 assert.equal(step(negotiating,"provider_connected",{callId:"invalid"}).error,"invalid_call_id");
 assert.equal(step(negotiating,"provider_connected",{callId:"rtc_valid123"}, {now:1}).ok,true);
 assert.equal(advanceOfflineSession(negotiating,"provider_connected",{callId:"rtc_valid123",now:0}).error,"invalid_transition_input");
});
test("input and snapshots are immutable and contain no identifiers",()=>{
 const s=start();assert.equal(Object.isFrozen(s),true);
 const r=step(s,"admit");assert.equal(s.state,"idle");assert.equal(r.session.revision,1);
 assert.deepEqual(Object.keys(sessionPublicSnapshot(r.session)).sort(),["needsReview","revision","state"]);
 assert.equal(createOfflineSession({reservationId:"x"}).ok,false);
});
