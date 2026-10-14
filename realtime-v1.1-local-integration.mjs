import assert from "node:assert/strict";
const base="http://127.0.0.1:8791";
const phase=process.argv[2];
const reserve=async()=>{const r=await fetch(base+"/__local/reserve",{method:"POST",headers:{"x-local-test":"infinity-voice-v11"}});return {status:r.status,data:await r.json()}};
const health=await fetch(base+"/health");assert.equal(health.status,200);assert.equal((await health.json()).openai_enabled,false);
const unauthorized=await fetch(base+"/__local/reserve",{method:"POST"});assert.equal(unauthorized.status,403);
if(phase==="initial"){
 const first=await reserve();assert.equal(first.status,200);
 const blocked=await reserve();assert.equal(blocked.status,429);assert.equal(blocked.data.error,"concurrency_limit");
 console.log("PASS: local Durable Object enforces concurrent limit");
}else if(phase==="persisted"){
 const blocked=await reserve();assert.equal(blocked.status,429);assert.equal(blocked.data.error,"concurrency_limit");
 console.log("PASS: reservation persists across Wrangler restart");
}else if(phase==="parallel"){
 const results=await Promise.all(Array.from({length:10},reserve));
 assert.equal(results.filter(x=>x.status===200).length,1);
 assert.equal(results.filter(x=>x.status===429).length,9);
 console.log("PASS: 10 simultaneous reservations allow exactly one");
}else throw Error("unknown phase");
