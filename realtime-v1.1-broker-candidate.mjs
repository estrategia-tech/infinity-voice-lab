/**
 * Infinity Voice Lab v1.1 — fail-closed HTTP boundary.
 * Auth is wired in; reservation and OpenAI minting intentionally are NOT.
 * This service never makes outbound requests or consumes reservations.
 */
import {checkLabAccess} from "./realtime-v1.1-access.mjs";
const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","vary":"Origin"};
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
export default {
 async fetch(request,env={}){
  const url=new URL(request.url);
  if(url.pathname==="/health" && request.method==="GET")
   return json({service:"infinity-voice-realtime-lab",version:"1.1.0-candidate",mode:"lab",realtime_enabled:false});
  if(url.pathname!=="/api/realtime/session")return json({error:"not_found"},404);
  if(request.method!=="POST")return json({error:"method_not_allowed"},405);
  const access=checkLabAccess(request,env);
  if(!access.ok)return json({error:access.error},access.status);
  // Authorized users still cannot start paid sessions, regardless of flags.
  // Deliberately no reservation: disabled requests must not consume quota.
  return json({error:"realtime_disabled",message:"Realtime lab sessions are not enabled."},403);
 }
};
