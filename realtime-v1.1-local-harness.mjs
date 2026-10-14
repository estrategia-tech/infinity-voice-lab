import {LabSessionLedger} from "./realtime-v1.1-ledger-candidate.mjs";
export {LabSessionLedger};
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/health") return Response.json({lab:true,openai_enabled:false});
  // Only local tests. No publicly deployed endpoint.
  if(url.pathname!=="/__local/reserve" || request.method!=="POST")
   return Response.json({error:"not_found"},{status:404});
  if(request.headers.get("x-local-test")!=="infinity-voice-v11")
   return Response.json({error:"forbidden"},{status:403});
  const stub=env.LAB_LEDGER.get(env.LAB_LEDGER.idFromName("single-ledger"));
  return stub.fetch(new Request("https://internal.invalid/internal/reserve",{method:"POST"}));
 }
};
