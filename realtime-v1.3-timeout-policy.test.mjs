import test from "node:test";
import assert from "node:assert/strict";
import {createTimeoutPolicy,evaluateTransportTimeout} from "./realtime-v1.3-timeout-policy.mjs";
const policy=createTimeoutPolicy({connectMs:1000,idleMs:2000,maxRetries:1}).policy;
const check=(state,now,lastActivityAt,connectedAt,retries=0)=>evaluateTransportTimeout({transport:{state,retries},policy,now,lastActivityAt,connectedAt});
test("deterministic connect and idle timeouts",()=>{
 assert.equal(check("connecting",999,0,0).action,"wait");
 assert.equal(check("connecting",1000,0,0).action,"interrupt");
 assert.equal(check("connected",2099,100,0).action,"wait");
 assert.equal(check("connected",2100,100,0).action,"interrupt");
});
test("exhausted retries demand review, never automatic termination",()=>{
 assert.equal(check("interrupted",200,0,0,0).action,"retry_eligible");
 assert.equal(check("interrupted",200,0,0,1).action,"manual_review");
 assert.equal(check("closed",200,0,0,0).action,"none");
 assert.equal(check("connected",100,101,0).error,"invalid_clock");
 assert.equal(createTimeoutPolicy({idleMs:0}).ok,false);
});
