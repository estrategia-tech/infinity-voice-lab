import test from "node:test";
import assert from "node:assert/strict";
import {hangupRealtimeCall} from "./realtime-v1.1-hangup-candidate.mjs";
const key="synthetic-api-key-only-000000000";
test("disabled default makes no network calls",async()=>{
 let calls=0;const x=await hangupRealtimeCall({callId:"rtc_12345678",apiKey:key,transport:async()=>{calls++;return {ok:true}}});
 assert.equal(x.status,403);assert.equal(calls,0);
});
test("invalid call id rejected without network calls",async()=>{
 let calls=0;const x=await hangupRealtimeCall({callId:"https://evil.test/a",apiKey:key,providerEnabled:true,transport:async()=>{calls++;return {ok:true}}});
 assert.equal(x.status,400);assert.equal(calls,0);
});
test("mock success calls exact documented hangup path",async()=>{
 let seen;const x=await hangupRealtimeCall({callId:"rtc_12345678",apiKey:key,providerEnabled:true,transport:async(url,options)=>{seen={url,options};return {ok:true,status:200}}});
 assert.equal(x.providerConfirmed,true);assert.equal(seen.url,"https://api.openai.com/v1/realtime/calls/rtc_12345678/hangup");
 assert.equal(seen.options.method,"POST");
});
test("failed and throwing transports never confirm termination",async()=>{
 for(const transport of [async()=>({ok:false,status:500}),async()=>{throw Error("offline")}]) {
  const x=await hangupRealtimeCall({callId:"rtc_12345678",apiKey:key,providerEnabled:true,transport});
  assert.equal(x.ok,false);assert.equal(x.error,"hangup_unconfirmed");
 }
});
