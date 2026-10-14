import test from "node:test";
import assert from "node:assert/strict";
import {AlarmLabLedger} from "./realtime-v1.1-alarm-ledger-candidate.mjs";
const id="12345678-1234-4234-8234-123456789abc";
const make=()=>{
 const m=new Map();let alarmAt;
 const storage={get:async k=>m.get(k),put:async(k,v)=>m.set(k,v),setAlarm:async v=>{alarmAt=v}};
 const ledger=new AlarmLabLedger({storage},{});
 const post=(path,data)=>ledger.fetch(new Request("https://internal.invalid"+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)}));
 return {ledger,post,get alarmAt(){return alarmAt}};
};
test("bind persists expiry and schedules alarm",async()=>{
 const l=make(),expiresAt=Date.now()+60000;
 const r=await l.post("/internal/bind",{reservationId:id,callId:"rtc_12345678",expiresAt});
 assert.equal(r.status,200);assert.equal(l.alarmAt,expiresAt);
 const status=await l.post("/internal/status",{});
 assert.equal((await status.json()).binding.status,"pending");
});
test("alarm never pretends to terminate a provider call",async()=>{
 const l=make();await l.post("/internal/bind",{reservationId:id,callId:"rtc_12345678",expiresAt:Date.now()+60000});
 await l.ledger.alarm();
 const r=await l.post("/internal/status",{});
 assert.equal((await r.json()).binding.status,"expired_unterminated");
});
test("rejects duplicate and invalid bindings",async()=>{
 const l=make();const data={reservationId:id,callId:"rtc_12345678",expiresAt:Date.now()+60000};
 assert.equal((await l.post("/internal/bind",{...data,callId:"bad"})).status,400);
 assert.equal((await l.post("/internal/bind",data)).status,200);
 assert.equal((await l.post("/internal/bind",data)).status,409);
});

test("explicit mock alarm calls coordinator and records mock-only result",async()=>{
 const m=new Map();let scheduled;
 const storage={get:async k=>m.get(k),put:async(k,v)=>m.set(k,v),setAlarm:async v=>{scheduled=v}};
 const l=new AlarmLabLedger({storage},{MOCK_ALARM_TERMINATION:true});
 const expiresAt=Date.now()+60000;
 const response=await l.fetch(new Request("https://internal.invalid/internal/bind",{method:"POST",
  headers:{"content-type":"application/json"},
  body:JSON.stringify({reservationId:id,callId:"rtc_12345678",expiresAt})}));
 assert.equal(response.status,200);assert.equal(scheduled,expiresAt);
 await l.alarm();
 assert.equal((await storage.get("binding")).status,"mock_terminated");
});

test("first mock provider failure persists retry, second succeeds",async()=>{
 const m=new Map();const alarms=[];
 const storage={get:async k=>m.get(k),put:async(k,v)=>m.set(k,v),setAlarm:async v=>alarms.push(v)};
 const l=new AlarmLabLedger({storage},{MOCK_ALARM_TERMINATION:true,MOCK_ALARM_FAIL_FIRST:true});
 const expiresAt=Date.now()+60000;
 const r=await l.fetch(new Request("https://internal.invalid/internal/bind",{method:"POST",
  headers:{"content-type":"application/json"},body:JSON.stringify({reservationId:id,callId:"rtc_12345678",expiresAt})}));
 assert.equal(r.status,200);
 await l.alarm();
 assert.equal((await storage.get("binding")).status,"mock_retry_pending");
 assert.equal((await storage.get("binding")).mockAttempts,1);
 assert.equal(alarms.length,2);
 await l.alarm();
 assert.equal((await storage.get("binding")).status,"mock_terminated");
 assert.equal((await storage.get("binding")).mockAttempts,2);
});

test("permanent mock provider failure exhausts retries and never claims termination",async()=>{
 const m=new Map();const alarms=[];
 const storage={get:async k=>m.get(k),put:async(k,v)=>m.set(k,v),setAlarm:async v=>alarms.push(v)};
 const l=new AlarmLabLedger({storage},{MOCK_ALARM_TERMINATION:true,MOCK_ALARM_FAIL_ALWAYS:true});
 const expiresAt=Date.now()+60000;
 const r=await l.fetch(new Request("https://internal.invalid/internal/bind",{method:"POST",
  headers:{"content-type":"application/json"},body:JSON.stringify({reservationId:id,callId:"rtc_12345678",expiresAt})}));
 assert.equal(r.status,200);
 await l.alarm();
 assert.equal((await storage.get("binding")).status,"mock_retry_pending");
 await l.alarm();
 const result=await storage.get("binding");
 assert.equal(result.status,"mock_termination_failed");
 assert.equal(result.mockAttempts,2);
 assert.equal(alarms.length,2);
 await l.alarm();
 assert.equal((await storage.get("binding")).mockAttempts,2);
});
