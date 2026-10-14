/** Strictly local integration harness. NEVER DEPLOY PUBLICLY. */
import {AlarmLabLedger} from "./realtime-v1.1-alarm-ledger-candidate.mjs";
export {AlarmLabLedger};
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==="/health")return Response.json({lab:true,openai_enabled:false});
  if(!["/__local/bind","/__local/status"].includes(path)||request.method!=="POST")
   return Response.json({error:"not_found"},{status:404});
  if(request.headers.get("x-local-test")!=="infinity-voice-alarm-only")
   return Response.json({error:"forbidden"},{status:403});
  const name=request.headers.get("x-ledger-name")==="restart"?"restart":"normal";
  const stub=env.ALARM_LEDGER.get(env.ALARM_LEDGER.idFromName(name));
  return stub.fetch(new Request("https://internal.invalid/internal/"+path.split("/").at(-1),{
   method:"POST",headers:{"content-type":"application/json"},
   body:path.endsWith("/bind")?await request.text():undefined
  }));
 }
};
