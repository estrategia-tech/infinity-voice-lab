/**
 * Infinity Voice Lab v1.1 — session broker, safe by default.
 * No OpenAI session minting in this candidate. An environment toggle alone
 * must never enable paid sessions before durable budgets and auth exist.
 */
const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/health" && request.method==="GET")
   return json({service:"infinity-voice-realtime-lab",version:"1.1.0-candidate",mode:"lab",realtime_enabled:false});
  if(url.pathname!=="/api/realtime/session")return json({error:"not_found"},404);
  if(request.method!=="POST")return json({error:"method_not_allowed"},405);
  // Fail closed even if someone accidentally enables a variable or adds an API key.
  // Required before enablement: server-side auth, origin allowlist, durable
  // rate/concurrency limits, hard budget enforcement and session expiry.
  return json({error:"realtime_disabled",message:"Realtime lab sessions are not enabled."},403);
 }
};
