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
 const offer="v=0\\r\\no=- 0 0 IN IP4 127.0.0.1\\r\\ns=-\\r\\nt=0 0\\r\\nm=audio 9 UDP/TLS/RTP/SAVPF 111\\r\\n";
 const send=async(token="synthetic-local-only-token-0123456789abcdef",body=offer)=>{
  const r=await fetch(base+"/__local/unified-mock",{method:"POST",headers:{origin:"https://lab.example.test",authorization:"Bearer "+token},body});
  return {status:r.status,data:await r.json()};
 };
 const denied=await send("invalid");assert.equal(denied.status,401);
 const invalid=await send(undefined,"invalid");assert.equal(invalid.status,400);
 const first=await send();assert.equal(first.status,200);assert.equal(first.data.mock,true);
 const second=await send();assert.equal(second.status,429);
 console.log("PASS: real local DO, auth, SDP, offline mock and concurrency");
}else throw Error("unknown phase");
