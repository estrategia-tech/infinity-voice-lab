import assert from "node:assert/strict";
const base=process.env.TEST_BASE_URL||"http://127.0.0.1:8794";
const phase=process.argv[2];
const headers={"x-local-test":"infinity-voice-alarm-only","x-ledger-name":"restart"};
const call=async(path,body)=>{
 const r=await fetch(base+"/__local/"+path,{method:"POST",headers,body:body?JSON.stringify(body):undefined});
 return {status:r.status,data:await r.json()};
};
assert.equal((await (await fetch(base+"/health")).json()).openai_enabled,false);
if(phase==="bind"){
 const expiresAt=Date.now()+12000;
 const x=await call("bind",{reservationId:"12345678-1234-4234-8234-123456789abc",callId:"rtc_12345678",expiresAt});
 assert.equal(x.status,200);
 assert.equal((await call("status")).data.binding.status,"pending");
 console.log("PASS: real DO alarm scheduled and binding persisted");
}else if(phase==="restart"){
 let result;
 for(let i=0;i<35;i++){
  result=await call("status");
  if(result.data.binding?.status==="mock_terminated")break;
  await new Promise(r=>setTimeout(r,1000));
 }
 assert.equal(result.data.binding?.status,"mock_terminated");
 console.log("PASS: real DO alarm fires after Wrangler restart, mock termination only");
}else throw Error("unknown phase");
