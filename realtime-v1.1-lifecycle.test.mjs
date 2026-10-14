import test from "node:test";
import assert from "node:assert/strict";
import {planSessionShutdown,validateBudgetGate} from "./realtime-v1.1-lifecycle-candidate.mjs";
test("unconfirmed provider termination cannot release reservation",()=>{
 const x=planSessionShutdown({reservationId:"r1",providerSessionId:"s1"});
 assert.equal(x.ok,false);assert.equal(x.releaseAllowed,false);
});
test("missing provider id is rejected",()=>assert.equal(planSessionShutdown({reservationId:"r1",providerTerminationConfirmed:true}).ok,false));
test("verified termination permits reservation release",()=>assert.equal(planSessionShutdown({reservationId:"r1",providerSessionId:"s1",providerTerminationConfirmed:true}).releaseAllowed,true));
test("paid session gate is denied by default",()=>assert.deepEqual(validateBudgetGate().missing,["hard_provider_cap","server_termination","price_model"]));
test("all independently verified requirements are necessary",()=>{
 assert.equal(validateBudgetGate({hardProviderCapVerified:true,serverTerminationVerified:true}).canEnable,false);
 assert.equal(validateBudgetGate({hardProviderCapVerified:true,serverTerminationVerified:true,priceModelVerified:true}).canEnable,true);
});
