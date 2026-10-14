/**
 * Infinity Voice v1.1 — Durable Object reservation ledger (candidate).
 * No external calls, no OpenAI API use, no deployment.
 * Reservations are admission controls, NOT a hard billing cap.
 */
export class LabSessionLedger {
  constructor(state, env) { this.state=state; this.env=env; }
  async fetch(request) {
    const url=new URL(request.url);
    if (!["/internal/reserve","/internal/release","/internal/bind","/internal/status"].includes(url.pathname) || request.method!=="POST")
      return Response.json({error:"not_found"},{status:404});
    // This is internal-only: the public broker must never expose this endpoint.
    if(url.pathname==="/internal/status"){
      // Read-only internal diagnostics: never expose this DO through the public broker.
      const sessions=(await this.state.storage.get("sessions"))||{};
      const now=Date.now();
      return Response.json({reservations:Object.entries(sessions).map(([reservationId,session])=>({
        reservationId,callId:session.callId??null,expiresAt:session.expiresAt,
        expired:session.expiresAt<=now
      }))});
    }
    if(url.pathname==="/internal/bind"){
      let data;
      try{data=await request.json()}catch{return Response.json({error:"invalid_request"},{status:400})}
      if(typeof data?.reservationId!=="string"||!/^[-a-f0-9]{36}$/i.test(data.reservationId)||
         typeof data?.callId!=="string"||!/^rtc_[A-Za-z0-9_-]{6,128}$/.test(data.callId))
       return Response.json({error:"invalid_binding"},{status:400});
      return this.state.storage.transaction(async txn=>{
       const sessions=(await txn.get("sessions"))||{};
       const session=sessions[data.reservationId];
       if(!session)return Response.json({error:"reservation_not_found"},{status:404});
       if(session.callId)return Response.json({error:"already_bound"},{status:409});
       sessions[data.reservationId]={...session,callId:data.callId};
       await txn.put("sessions",sessions);
       return Response.json({bound:true});
      });
    }
    if(url.pathname==="/internal/release"){
      let data;
      try{data=await request.json()}catch{return Response.json({error:"invalid_request"},{status:400})}
      if(typeof data?.reservationId!=="string"||!/^[-a-f0-9]{36}$/i.test(data.reservationId))
       return Response.json({error:"invalid_reservation_id"},{status:400});
      return this.state.storage.transaction(async txn=>{
        const sessions=(await txn.get("sessions"))||{};
        if(!Object.hasOwn(sessions,data.reservationId))
         return Response.json({error:"reservation_not_found"},{status:404});
        const session=sessions[data.reservationId];
        // A bound provider call can only be released by the server-side
        // coordinator holding a separate internal capability.
        if(session.callId && (typeof this.env?.INTERNAL_RELEASE_TOKEN!=="string" ||
          this.env.INTERNAL_RELEASE_TOKEN.length<32 ||
          request.headers.get("x-internal-release-token")!==this.env.INTERNAL_RELEASE_TOKEN))
         return Response.json({error:"release_unauthorized"},{status:403});
        if(session.callId && data.callId!==session.callId)
         return Response.json({error:"bound_call_mismatch"},{status:409});
        if(session.callId && data.providerAcknowledged!==true)
         return Response.json({error:"termination_unconfirmed"},{status:409});
        delete sessions[data.reservationId];
        await txn.put("sessions",sessions);
        return Response.json({released:true});
      });
    }
    const limits={maxConcurrent:1,maxSessionsPerDay:3,maxSecondsPerSession:120};
    const now=Date.now();
    const day=new Date(now).toISOString().slice(0,10);
    return this.state.storage.transaction(async txn=>{
      const oldDay=await txn.get("day");
      if(oldDay!==day) {
        await txn.put("day",day);
        await txn.put("count",0);
      }
      const count=(await txn.get("count"))||0;
      const sessions=(await txn.get("sessions"))||{};
      // Fail closed: time expiry is not evidence that a provider call stopped.
      // Keep all unresolved reservations occupying capacity until an explicit
      // server-side release follows confirmed provider termination.
      const active=Object.entries(sessions);
      if(active.length>=limits.maxConcurrent) return Response.json({error:"concurrency_limit"},{status:429});
      if(count>=limits.maxSessionsPerDay) return Response.json({error:"daily_session_limit"},{status:429});
      const id=crypto.randomUUID();
      sessions[id]={expiresAt:now+limits.maxSecondsPerSession*1000};
      await txn.put("sessions",sessions);
      await txn.put("count",count+1);
      return Response.json({reservationId:id,maxSeconds:limits.maxSecondsPerSession,expiresAt:now+limits.maxSecondsPerSession*1000});
    });
  }
}
