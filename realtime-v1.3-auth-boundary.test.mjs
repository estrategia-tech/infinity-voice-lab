import test from "node:test";
import assert from "node:assert/strict";
import {validateTransportCapability,authorizeMockFrame} from "./realtime-v1.3-auth-boundary.mjs";
const capability={issuer:"local-test-only",scope:"voice:mock",sessionId:"mock_session_001",expiresAt:2000};
test("mock capability scope, expiry, session isolation",()=>{
 assert.equal(validateTransportCapability(capability,{now:1000}).ok,true);
 assert.equal(validateTransportCapability(capability,{now:2000}).ok,false);
 assert.equal(validateTransportCapability({...capability,scope:"voice:live"},{now:1000}).ok,false);
 assert.equal(validateTransportCapability({...capability,issuer:"production"},{now:1000}).ok,false);
 assert.equal(validateTransportCapability({...capability,expiresAt:100000},{now:1000}).ok,false);
 assert.equal(authorizeMockFrame(capability,{sessionId:"mock_session_001",sequence:1,type:"control"},{now:1000}).ok,true);
 assert.equal(authorizeMockFrame(capability,{sessionId:"mock_other_123",sequence:1,type:"control"},{now:1000}).ok,false);
 assert.equal(authorizeMockFrame(capability,{sessionId:"mock_session_001",sequence:1,type:"control",secret:"no"},{now:1000}).ok,false);
});
