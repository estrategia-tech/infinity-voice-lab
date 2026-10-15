import test from "node:test";
import assert from "node:assert/strict";
import {createOfflineProviderAdapter,applyOfflineProviderEvent,validateProviderEvent} from "./realtime-v2.0-provider-contract.mjs";
test("mock provider lifecycle requires explicit simulated close receipt",()=>{
 let a=createOfflineProviderAdapter({sessionId:"mock_provider_001"}).adapter;
 for(const [event,status,providerReceipt] of [["session_open_requested","opening"],["session_open_confirmed","open"],["session_close_requested","closing"],["session_close_confirmed","closed","mock-only-confirmation"]]){
 const r=applyOfflineProviderEvent(a,{event,sessionId:a.sessionId,sequence:a.sequence+1,...(providerReceipt?{providerReceipt}:{})});
 assert.equal(r.ok,true);assert.equal(r.adapter.status,status);a=r.adapter;
 }
 assert.equal(a.providerConfirmedClose,true);
});
test("fail closed on spoofed receipt, replay and missing close proof",()=>{
 let a=createOfflineProviderAdapter({sessionId:"mock_provider_002"}).adapter;
 assert.equal(validateProviderEvent({event:"session_open_requested",sessionId:a.sessionId,sequence:1,token:"secret"}).ok,false);
 assert.equal(applyOfflineProviderEvent(a,{event:"session_open_confirmed",sessionId:a.sessionId,sequence:1}).ok,false);
 for(const event of ["session_open_requested","session_open_confirmed","session_close_requested"]){a=applyOfflineProviderEvent(a,{event,sessionId:a.sessionId,sequence:a.sequence+1}).adapter;}
 assert.equal(applyOfflineProviderEvent(a,{event:"session_close_confirmed",sessionId:a.sessionId,sequence:4}).error,"missing_mock_receipt");
 assert.equal(applyOfflineProviderEvent(a,{event:"session_close_confirmed",sessionId:"mock_other_000",sequence:4,providerReceipt:"mock-only-confirmation"}).error,"session_or_sequence_mismatch");
 assert.equal(applyOfflineProviderEvent(a,{event:"session_close_confirmed",sessionId:a.sessionId,sequence:4,providerReceipt:"real-proof"}).error,"untrusted_receipt");
});
