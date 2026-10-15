import test from "node:test";
import assert from "node:assert/strict";
import {createMockTransport,transitionTransport,sendMockFrame} from "./realtime-v1.3-transport-candidate.mjs";
test("offline transport lifecycle and bounded retries",()=>{
 let t=createMockTransport({maxRetries:2}).transport;
 for(const e of ["connect","connected","drop","retry","connected","drop","retry","failure"]){
  const r=transitionTransport(t,e);assert.equal(r.ok,true,e);t=r.transport;
 }
 assert.equal(t.state,"interrupted");
 assert.equal(transitionTransport(t,"retry").error,"retry_limit");
 assert.equal(transitionTransport(t,"close").transport.state,"closed");
 assert.equal(transitionTransport({...t,state:"closed"},"connect").ok,false);
});
test("frames only on connected transport, no payload or replay",()=>{
 let t=createMockTransport().transport;
 assert.equal(sendMockFrame(t,{sequence:1,type:"control"}).error,"transport_not_connected");
 t=transitionTransport(transitionTransport(t,"connect").transport,"connected").transport;
 assert.equal(sendMockFrame(t,{sequence:2,type:"control"}).error,"invalid_frame");
 assert.equal(sendMockFrame(t,{sequence:1,type:"audio_metadata",rawAudio:"secret"}).error,"invalid_frame");
 const first=sendMockFrame(t,{sequence:1,type:"audio_metadata"});
 assert.equal(first.ok,true);
 assert.equal(sendMockFrame(first.transport,{sequence:1,type:"control"}).error,"invalid_frame");
 assert.equal(sendMockFrame(first.transport,{sequence:2,type:"control"}).ok,true);
});
test("reject invalid retry policy",()=>{
 assert.equal(createMockTransport({maxRetries:-1}).ok,false);
 assert.equal(createMockTransport({maxRetries:999}).ok,false);
});
