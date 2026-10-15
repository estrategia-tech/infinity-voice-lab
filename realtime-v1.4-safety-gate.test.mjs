import test from "node:test";
import assert from "node:assert/strict";
import {evaluateMockDecision} from "./realtime-v1.4-safety-gate.mjs";
test("unverified material never sent; handoff never automatically executed",()=>{
 assert.deepEqual(evaluateMockDecision({action:"offer_verified_materials"}),{ok:true,disposition:"hold_for_verification",execute:false});
 assert.equal(evaluateMockDecision({action:"offer_verified_materials"},{materialsVerified:true}).execute,false);
 assert.equal(evaluateMockDecision({action:"request_human_review"},{humanAvailable:true}).execute,false);
 assert.equal(evaluateMockDecision({action:"request_human_review"},{humanAvailable:false}).disposition,"handoff_pending");
 assert.equal(evaluateMockDecision({action:"publish_price"}).ok,false);
});
