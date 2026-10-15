import assert from "node:assert/strict";
const base=process.env.TEST_BASE_URL || "http://127.0.0.1:8791";
const phase=process.argv[2];
const reserve=async()=>{const r=await fetch(base+"/__local/reserve",{method:"POST",headers:{"x-local-test":"infinity-voice-v11"}});return {status:r.status,data:await r.json()}};
const health=await fetch(base+"/health");assert.equal(health.status,200);assert.equal((await health.json()).openai_enabled,false);
const unauthorized=await fetch(base+"/__local/reserve",{method:"POST"});assert.equal(unauthorized.status,403);
if(phase==="initial"){
 const denied=await fetch(base+"/api/realtime/session",{method:"POST",headers:{"Origin":"https://estrategia-tech.github.io","Authorization":"Bearer synthetic"}});
 assert.equal(denied.status,503);
 assert.equal((await denied.json()).error,"lab_not_configured");
 // Disabled session requests must not consume the Durable Object reservation.

 const first=await reserve();assert.equal(first.status,200);
 const blocked=await reserve();assert.equal(blocked.status,429);assert.equal(blocked.data.error,"concurrency_limit");
 const released=await fetch(base+"/__local/release",{method:"POST",headers:{"x-local-test":"infinity-voice-v11","Content-Type":"application/json"},body:JSON.stringify({reservationId:first.data.reservationId})});
 assert.equal(released.status,200);
 const next=await reserve();assert.equal(next.status,200);
 console.log("PASS: local Durable Object enforces concurrency and release");
}else if(phase==="persisted"){
 const blocked=await reserve();assert.equal(blocked.status,429);assert.equal(blocked.data.error,"concurrency_limit");
 console.log("PASS: reservation persists across Wrangler restart");
}else if(phase==="parallel"){
 const results=await Promise.all(Array.from({length:10},reserve));
 assert.equal(results.filter(x=>x.status===200).length,1);
 assert.equal(results.filter(x=>x.status===429).length,9);
 console.log("PASS: 10 simultaneous reservations allow exactly one");
}else if(phase==="unified"){
 const offer="v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
 const send=async(token="synthetic-local-only-token-0123456789abcdef",body=offer)=>{
  const r=await fetch(base+"/__local/unified-mock",{method:"POST",headers:{origin:"https://lab.example.test",authorization:"Bearer "+token},body});
  return {status:r.status,data:await r.json()};
 };
 const denied=await send("invalid");assert.equal(denied.status,401);
 const invalid=await send(undefined,"invalid");assert.equal(invalid.status,400);
 const first=await send();assert.equal(first.status,200);assert.equal(first.data.mock,true);
 const second=await send();assert.equal(second.status,429);
 console.log("PASS: real local DO, auth, SDP, offline mock and concurrency");
}else if(phase==="alarm-persisted"){
 const status=await fetch(base+"/__local/status",{method:"POST",headers:{"x-local-test":"infinity-voice-v11"}});
 assert.equal(status.status,200);
 const reservations=(await status.json()).reservations;
 assert.equal(reservations.length,1);
 assert.equal(reservations[0].callId,"rtc_12345678");
 assert.equal(reservations[0].status,"expired_unterminated");
 assert.equal(reservations[0].expired,true);
 assert.equal((await reserve()).status,429);
 console.log("PASS: same-DO alarm survives restart and never frees unresolved call");
}else if(phase==="alarm-initial"){
 const first=await reserve();assert.equal(first.status,200);
 const r=await fetch(base+"/__local/bind",{method:"POST",headers:{"x-local-test":"infinity-voice-v11","content-type":"application/json"},body:JSON.stringify({reservationId:first.data.reservationId,callId:"rtc_12345678"})});
 assert.equal(r.status,200);
 console.log("PASS: bound call persisted; waiting for same-DO expiry alarm");
}else if(phase==="reconciliation-status"){
 const first=await reserve();assert.equal(first.status,200);
 const status=async()=>{
  const r=await fetch(base+"/__local/status",{method:"POST",headers:{"x-local-test":"infinity-voice-v11"}});
  assert.equal(r.status,200);return r.json();
 };
 const initial=await status();
 assert.equal(initial.reservations.length,1);
 assert.equal(initial.reservations[0].reservationId,first.data.reservationId);
 assert.equal(initial.reservations[0].callId,null);
 const bind=await fetch(base+"/__local/bind",{method:"POST",headers:{"x-local-test":"infinity-voice-v11","content-type":"application/json"},body:JSON.stringify({reservationId:first.data.reservationId,callId:"rtc_12345678"})});
 assert.equal(bind.status,200);
 const bound=await status();assert.equal(bound.reservations[0].callId,"rtc_12345678");
 const {reconcilePrimaryLedger}=await import("./realtime-v1.1-primary-reconciliation.mjs");
 const primaryStub={fetch:()=>fetch(base+"/__local/status",{method:"POST",headers:{"x-local-test":"infinity-voice-v11"}})};
 const primary=await reconcilePrimaryLedger({ledgerStub:primaryStub});
 assert.equal(primary.ok,true);
 assert.equal(primary.results[0].status,"pending");
 assert.equal(primary.providerVerified,false);
 const {reconcileLabState}=await import("./realtime-v1.1-reconciliation.mjs");
 const ledgerStub={fetch:()=>fetch(base+"/__local/status",{method:"POST",headers:{"x-local-test":"infinity-voice-v11"}})};
 const alarmStub={fetch:async()=>Response.json({binding:null})};
 const diagnosis=await reconcileLabState({ledgerStub,alarmStub});
 assert.equal(diagnosis.ok,true);
 assert.equal(diagnosis.results[0].status,"alarm_binding_missing_or_mismatched");
 assert.equal(diagnosis.autoReleased,false);
 assert.equal(diagnosis.requiresReview,true);
 assert.equal((await reserve()).status,429);
 const publicStatus=await fetch(base+"/internal/status",{method:"POST"});
 assert.equal(publicStatus.status,404);
 console.log("PASS: read-only DO status tracks bound call without freeing reservation");
}else if(phase==="atomic-claim"){
 const first=await reserve();assert.equal(first.status,200);
 const post=async(path,data,authorized=true)=>{
  const r=await fetch(base+"/__local/"+path,{method:"POST",headers:{
   "x-local-test":"infinity-voice-v11","content-type":"application/json",
   ...(authorized?{"x-local-authorized-release":"yes"}:{})
  },body:JSON.stringify(data)});
  return {status:r.status,data:await r.json()};
 };
 const binding={reservationId:first.data.reservationId,callId:"rtc_atomic123"};
 assert.equal((await post("bind",binding)).status,200);
 assert.equal((await post("claim-termination",binding,false)).status,403);
 const results=await Promise.all(Array.from({length:12},()=>post("claim-termination",binding)));
 assert.equal(results.filter(r=>r.status===200).length,1);
 assert.equal(results.filter(r=>r.status===409).length,11);
 const claimId=results.find(r=>r.status===200).data.claimId;
 assert.ok(claimId);
 assert.equal((await post("release",{...binding,providerAcknowledged:true,claimId:"incorrect"})).status,409);
 assert.equal((await post("abort-termination",{...binding,claimId})).status,200);
 assert.equal((await post("claim-termination",binding)).status,409);
 assert.equal((await reserve()).status,429);
 assert.equal((await fetch(base+"/internal/claim-termination",{method:"POST"})).status,404);
 console.log("PASS: 12 simultaneous claims yield exactly one winner, uncertain call remains occupied");
}else if(phase==="bound-release"){
 const first=await reserve();assert.equal(first.status,200);
 const post=async(path,data,authorized=false)=>{
  const r=await fetch(base+"/__local/"+path,{method:"POST",headers:{
   "x-local-test":"infinity-voice-v11","Content-Type":"application/json",
   ...(authorized?{"x-local-authorized-release":"yes"}:{})
  },body:JSON.stringify(data)});
  return {status:r.status,data:await r.json()};
 };
 const reservationId=first.data.reservationId,callId="rtc_12345678";
 assert.equal((await post("bind",{reservationId,callId})).status,200);
 assert.equal((await post("release",{reservationId,callId,providerAcknowledged:true})).status,403);
 assert.equal((await post("release",{reservationId,callId:"rtc_wrong123",providerAcknowledged:true},true)).status,409);
 assert.equal((await post("release",{reservationId,callId},true)).status,409);
 assert.equal((await reserve()).status,429);
 assert.equal((await post("release",{reservationId,callId,providerAcknowledged:true},true)).status,409);
 const claim=await post("claim-termination",{reservationId,callId},true);
 assert.equal(claim.status,200);
 assert.equal((await post("release",{reservationId,callId,claimId:claim.data.claimId,providerAcknowledged:true},true)).status,200);
 assert.equal((await reserve()).status,200);
 console.log("PASS: real local DO blocks forged release and requires server capability");
}else throw Error("unknown phase");
