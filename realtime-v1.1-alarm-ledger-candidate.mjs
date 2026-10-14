/**
 * Isolated alarm-capable Durable Object candidate. Local/mock only.
 * Never sends OpenAI requests. Expiry is NOT proof of provider termination.
 * Stores only synthetic test call IDs, no credentials.
 */
export class AlarmLabLedger {
 constructor(state,env){this.state=state;this.env=env;}
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(request.method!=="POST"||!["/internal/bind","/internal/status"].includes(path))
   return Response.json({error:"not_found"},{status:404});
  if(path==="/internal/status"){
   const binding=await this.state.storage.get("binding");
   return Response.json({binding:binding??null});
  }
  let data;try{data=await request.json()}catch{return Response.json({error:"invalid_request"},{status:400})}
  if(typeof data?.reservationId!=="string"||!/^[-a-f0-9]{36}$/i.test(data.reservationId)||
   typeof data?.callId!=="string"||!/^rtc_[A-Za-z0-9_-]{6,128}$/.test(data.callId)||
   !Number.isSafeInteger(data.expiresAt)||data.expiresAt<=Date.now()||data.expiresAt>Date.now()+120000)
   return Response.json({error:"invalid_binding"},{status:400});
  const existing=await this.state.storage.get("binding");
  if(existing)return Response.json({error:"already_bound"},{status:409});
  const binding={reservationId:data.reservationId,callId:data.callId,expiresAt:data.expiresAt,status:"pending"};
  await this.state.storage.put("binding",binding);
  await this.state.storage.setAlarm(data.expiresAt);
  return Response.json({bound:true,expiresAt:data.expiresAt});
 }
 async alarm(){
  const binding=await this.state.storage.get("binding");
  if(!binding||!["pending","mock_retry_pending"].includes(binding.status))return;
  // Explicitly mock-only: never invoke provider from an alarm in this candidate.
  // The real provider transport and credentials are deliberately absent.
  if(this.env?.MOCK_ALARM_TERMINATION===true){
   const {expireBoundCall}=await import("./realtime-v1.1-timeout-coordinator.mjs");
   const attempt=(binding.mockAttempts||0)+1;
   const simulateFailure=this.env?.MOCK_ALARM_FAIL_FIRST===true && attempt===1;
   const fakeLedger={fetch:async()=>Response.json({released:true})};
   const outcome=await expireBoundCall({
    binding,now:Math.max(Date.now(),binding.expiresAt),
    apiKey:"synthetic-alarm-only-key-000000",
    providerEnabled:true,
    transport:async()=>simulateFailure?({ok:false,status:503}):({ok:true,status:200}),
    ledgerStub:fakeLedger
   });
   if(outcome.ok){
    await this.state.storage.put("binding",{...binding,mockAttempts:attempt,status:"mock_terminated"});
    return;
   }
   if(attempt<2){
    await this.state.storage.put("binding",{...binding,mockAttempts:attempt,status:"mock_retry_pending"});
    await this.state.storage.setAlarm(Date.now()+1000);
    return;
   }
   await this.state.storage.put("binding",{...binding,mockAttempts:attempt,status:"mock_termination_failed"});
   return;
  }
  // No provider connection configured. Never release capacity or pretend
  // the provider session ended.
  await this.state.storage.put("binding",{...binding,status:"expired_unterminated"});
 }
}
