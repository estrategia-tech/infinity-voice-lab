/**
 * Infinity Voice v1.1 — Durable Object reservation ledger (candidate).
 * No external calls, no OpenAI API use, no deployment.
 * Reservations are admission controls, NOT a hard billing cap.
 */
export class LabSessionLedger {
  constructor(state, env) { this.state=state; this.env=env; }
  async fetch(request) {
    const url=new URL(request.url);
    if (url.pathname!=="/internal/reserve" || request.method!=="POST")
      return Response.json({error:"not_found"},{status:404});
    // This is internal-only: the public broker must never expose this endpoint.
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
      const active=Object.values(sessions).filter(s=>s.expiresAt>now);
      if(active.length>=limits.maxConcurrent) return Response.json({error:"concurrency_limit"},{status:429});
      if(count>=limits.maxSessionsPerDay) return Response.json({error:"daily_session_limit"},{status:429});
      const id=crypto.randomUUID();
      sessions[id]={expiresAt:now+limits.maxSecondsPerSession*1000};
      await txn.put("sessions",Object.fromEntries(active.map(s=>[Object.keys(sessions).find(k=>sessions[k]===s),s]).concat([[id,sessions[id]]])));
      await txn.put("count",count+1);
      return Response.json({reservationId:id,maxSeconds:limits.maxSecondsPerSession,expiresAt:now+limits.maxSecondsPerSession*1000});
    });
  }
}
