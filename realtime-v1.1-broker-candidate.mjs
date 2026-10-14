/**
 * Infinity Voice Lab v1.1 — fail-closed session broker candidate.
 * Intentionally does NOT mint OpenAI credentials or start sessions.
 * Deploy ONLY to a new isolated lab Worker after a separate security review.
 */
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/health" && request.method==="GET")
   return json({service:"infinity-voice-realtime-lab",version:"1.1.0-candidate",mode:"lab",realtime_enabled:false});
  if(url.pathname!=="/api/realtime/session")return json({error:"not_found"},404);
  if(request.method!=="POST")return json({error:"method_not_allowed"},405);
  // No permissive CORS, no auth bypass, no key use, no credit consumption.
  // Future implementation requires origin allowlist, constant-time lab auth,
  // server-enforced budget, duration, concurrency and expiration controls.
  return json({error:"realtime_disabled",message:"Realtime lab sessions are not enabled."},403);
 }
};
