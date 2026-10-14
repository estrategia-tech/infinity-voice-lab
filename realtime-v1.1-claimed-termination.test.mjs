import test from "node:test";
import assert from "node:assert/strict";
import {LabSessionLedger} from "./realtime-v1.1-ledger-candidate.mjs";
import {terminateClaimedCall} from "./realtime-v1.1-claimed-termination.mjs";
const token="synthetic-internal-release-token-0123456789",callId="rtc_12345678";
async function setup(){
 const map=new Map();
 const storage={get:async k=>map.get(k),put:async(k,v)=>map.set(k,structuredClone(v)),
  transaction:async fn=>fn(storage),setAlarm:async()=>{}};
 const ledger=new LabSessionLedger({storage},{INTERNAL_RELEASE_TOKEN:token});
 const post=(path,body)=>ledger.fetch(new Request("https://internal.invalid/internal/"+path,{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body??{})
 }));
 const reservationId=(await (await post("reserve")).json()).reservationId;
 assert.equal((await post("bind",{reservationId,callId})).status,200);
 return {ledger,reservationId,map};
}
test("atomic claim allows only one simultaneous hangup",async()=>{
 const {ledger,reservationId}=await setup();
 let hangups=0;
 let resolveFirst;const wait=new Promise(r=>{resolveFirst=r});
 const options={ledgerStub:ledger,reservationId,callId,releaseToken:token,providerEnabled:true,
  apiKey:"synthetic-provider-key-0123456789",transport:async()=>{hangups++;await wait;return {ok:true,status:200}}};
 const first=terminateClaimedCall(options);
 for(let i=0;i<100&&hangups===0;i++)await new Promise(r=>setTimeout(r,0));
 assert.equal(hangups,1);
 const second=await terminateClaimedCall(options);
 assert.equal(second.ok,false);assert.equal(second.error,"termination_already_claimed");
 resolveFirst();
 assert.equal((await first).ok,true);
 assert.equal(hangups,1);
});
test("provider failure marks uncertain and retains capacity",async()=>{
 const {ledger,reservationId}=await setup();
 const r=await terminateClaimedCall({ledgerStub:ledger,reservationId,callId,releaseToken:token,
  providerEnabled:true,apiKey:"synthetic-provider-key-0123456789",
  transport:async()=>({ok:false,status:503})});
 assert.equal(r.ok,false);assert.equal(r.requiresReview,true);
 const status=await (await ledger.fetch(new Request("https://internal.invalid/internal/status",{method:"POST"}))).json();
 assert.equal(status.reservations[0].status,"termination_uncertain");
 assert.equal((await ledger.fetch(new Request("https://internal.invalid/internal/reserve",{method:"POST"}))).status,429);
});
test("invalid capability prevents provider hangup",async()=>{
 const {ledger,reservationId}=await setup();let calls=0;
 const r=await terminateClaimedCall({ledgerStub:ledger,reservationId,callId,
  releaseToken:"invalid",providerEnabled:true,transport:async()=>{calls++;return {ok:true}}});
 assert.equal(r.status,403);assert.equal(calls,0);
});
test("disabled provider cannot claim or call",async()=>{
 const {ledger,reservationId}=await setup();let calls=0;
 const r=await terminateClaimedCall({ledgerStub:ledger,reservationId,callId,
  releaseToken:token,transport:async()=>{calls++;return {ok:true}}});
 assert.equal(r.status,403);assert.equal(calls,0);
});
