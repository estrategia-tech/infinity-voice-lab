import test from "node:test";
import assert from "node:assert/strict";
import {LabSessionLedger} from "./realtime-v1.1-ledger-candidate.mjs";
function setup(){
 const map=new Map();
 const storage={get:async k=>map.get(k),put:async(k,v)=>{map.set(k,structuredClone(v))},transaction:async fn=>fn(storage)};
 const ledger=new LabSessionLedger({storage},{});
 const call=async(method="POST",path="/internal/reserve")=>{
  const r=await ledger.fetch(new Request("https://lab.invalid"+path,{method}));
  return {status:r.status,body:await r.json()};
 };
 return {call,map};
}
test("only internal POST reservation route",async()=>{
 const {call}=setup();
 assert.equal((await call("GET")).status,404);
 assert.equal((await call("POST","/unknown")).status,404);
});
test("one concurrent session; expiry never frees unresolved slot",async()=>{
 const {call,map}=setup();
 const first=await call();assert.equal(first.status,200);
 assert.equal((await call()).body.error,"concurrency_limit");
 const sessions=map.get("sessions");
 sessions[first.body.reservationId].expiresAt=Date.now()-1;
 map.set("sessions",sessions);
 assert.equal((await call()).body.error,"concurrency_limit");
});
test("three explicit releases consume daily quota",async()=>{
 const {call,map}=setup();
 for(let i=0;i<3;i++){
  const r=await call();assert.equal(r.status,200);
  const ledger=new LabSessionLedger({storage:{
   get:async k=>map.get(k),put:async(k,v)=>map.set(k,structuredClone(v)),
   transaction:async fn=>fn({get:async k=>map.get(k),put:async(k,v)=>map.set(k,structuredClone(v))})
  }},{});
  const released=await ledger.fetch(new Request("https://lab.invalid/internal/release",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reservationId:r.body.reservationId})}));
  assert.equal(released.status,200);
 }
 const r=await call();
 assert.equal(r.status,429);
 assert.equal(r.body.error,"daily_session_limit");
});
test("a changed UTC day resets count",async()=>{
 const {call,map}=setup();
 map.set("day","2000-01-01");
 map.set("count",3);
 assert.equal((await call()).status,200);
 assert.equal(map.get("count"),1);
});
test("storage failures never grant reservation",async()=>{
 const ledger=new LabSessionLedger({storage:{transaction:async()=>{throw Error("storage down")}}},{});
 await assert.rejects(()=>ledger.fetch(new Request("https://lab.invalid/internal/reserve",{method:"POST"})),/storage down/);
});

test("release frees concurrency but never refunds daily usage",async()=>{
 const {call,map}=setup();
 const first=await call();assert.equal(first.status,200);
 const ledger=new LabSessionLedger({storage:{get:async k=>map.get(k),put:async(k,v)=>map.set(k,structuredClone(v)),transaction:async fn=>fn({get:async k=>map.get(k),put:async(k,v)=>map.set(k,structuredClone(v))})}},{});
 const release=async body=>{const r=await ledger.fetch(new Request("https://lab.invalid/internal/release",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()}};
 assert.equal((await release({reservationId:"bad"})).status,400);
 assert.equal((await release({reservationId:first.body.reservationId})).status,200);
 assert.equal((await release({reservationId:first.body.reservationId})).status,404);
 assert.equal((await call()).status,200);
 assert.equal(map.get("count"),2);
});

test("bound provider call cannot be released without matching confirmed identity",async()=>{
 const {call,map}=setup();
 const first=await call();assert.equal(first.status,200);
 const secret="synthetic-internal-release-token-0123456789";
 const ledger=new LabSessionLedger({storage:{
  get:async k=>map.get(k),put:async(k,v)=>map.set(k,structuredClone(v)),
  transaction:async fn=>fn({get:async k=>map.get(k),put:async(k,v)=>map.set(k,structuredClone(v))}),
  setAlarm:async at=>map.set("scheduledAlarm",at)
 }},{INTERNAL_RELEASE_TOKEN:secret});
 const post=async(path,data,authorized=false)=>{
  const r=await ledger.fetch(new Request("https://lab.invalid"+path,{method:"POST",headers:{"content-type":"application/json",...(authorized?{"x-internal-release-token":secret}:{})},body:JSON.stringify(data)}));
  return {status:r.status,body:await r.json()};
 };
 const reservationId=first.body.reservationId;
 assert.equal((await post("/internal/bind",{reservationId,callId:"rtc_12345678"})).status,200);
 assert.equal((await post("/internal/bind",{reservationId,callId:"rtc_12345678"})).status,409);
 assert.equal((await post("/internal/release",{reservationId})).body.error,"release_unauthorized");
 assert.equal((await post("/internal/release",{reservationId,callId:"rtc_12345678",providerAcknowledged:true})).status,403);
 assert.equal((await post("/internal/release",{reservationId,callId:"rtc_12345678"},true)).body.error,"termination_unconfirmed");
 assert.equal((await call()).body.error,"concurrency_limit");
 assert.equal((await post("/internal/release",{reservationId,callId:"rtc_12345678",providerAcknowledged:true},true)).status,200);
 assert.equal((await call()).status,200);
});

test("same reservation DO alarm marks expiry without freeing capacity",async()=>{
 const map=new Map();let alarmAt;
 const storage={
  get:async k=>map.get(k),put:async(k,v)=>map.set(k,structuredClone(v)),
  transaction:async fn=>fn(storage),setAlarm:async at=>{alarmAt=at}
 };
 const ledger=new LabSessionLedger({storage},{});
 const post=async(path,data)=>ledger.fetch(new Request("https://internal.invalid"+path,{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data??{})
 }));
 const reserved=await post("/internal/reserve");
 const {reservationId,expiresAt}=await reserved.json();
 const bound=await post("/internal/bind",{reservationId,callId:"rtc_12345678"});
 assert.equal(bound.status,200);
 assert.equal(alarmAt,expiresAt);
 map.get("sessions")[reservationId].expiresAt=Date.now()-1;
 await ledger.alarm();
 const status=await (await post("/internal/status")).json();
 assert.equal(status.reservations[0].status,"expired_unterminated");
 assert.equal((await post("/internal/reserve")).status,429);
});
test("alarm scheduling failure remains occupied and flagged",async()=>{
 const map=new Map();
 const storage={
  get:async k=>map.get(k),put:async(k,v)=>map.set(k,structuredClone(v)),
  transaction:async fn=>fn(storage),setAlarm:async()=>{throw Error("alarm unavailable")}
 };
 const ledger=new LabSessionLedger({storage},{});
 const post=async(path,data)=>ledger.fetch(new Request("https://internal.invalid"+path,{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data??{})
 }));
 const first=await (await post("/internal/reserve")).json();
 const r=await post("/internal/bind",{reservationId:first.reservationId,callId:"rtc_12345678"});
 assert.equal(r.status,503);
 const status=await (await post("/internal/status")).json();
 assert.equal(status.reservations[0].status,"alarm_schedule_failed");
 assert.equal((await post("/internal/reserve")).status,429);
});

test("expired unbound reservation cannot be bound or silently reused",async()=>{
 const map=new Map();
 const storage={get:async k=>map.get(k),put:async(k,v)=>map.set(k,structuredClone(v)),
  transaction:async fn=>fn(storage),setAlarm:async()=>{}};
 const ledger=new LabSessionLedger({storage},{});
 const post=async(path,data)=>ledger.fetch(new Request("https://internal.invalid"+path,{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data??{})
 }));
 const first=await (await post("/internal/reserve")).json();
 const sessions=map.get("sessions");
 sessions[first.reservationId].expiresAt=Date.now()-1;
 map.set("sessions",sessions);
 const bind=await post("/internal/bind",{reservationId:first.reservationId,callId:"rtc_12345678"});
 assert.equal(bind.status,409);
 assert.equal((await bind.json()).error,"reservation_expired");
 assert.equal((await post("/internal/reserve")).status,429);
});
