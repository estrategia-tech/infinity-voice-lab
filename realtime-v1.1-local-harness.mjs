import {LabSessionLedger} from "./realtime-v1.1-ledger-candidate.mjs";
import broker from "./realtime-v1.1-broker-candidate.mjs";
import {rehearseUnifiedSession} from "./realtime-v1.1-unified-rehearsal.mjs";
export {LabSessionLedger};
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/health") return Response.json({lab:true,openai_enabled:false});
  // Exercise the actual fail-closed broker over local HTTP. Do not route
  // reservations or secrets to OpenAI.
  if(url.pathname==="/api/realtime/session")return broker.fetch(request,env);
  if(url.pathname==="/__local/unified-mock" && request.method==="POST"){
   const stub=env.LAB_LEDGER.get(env.LAB_LEDGER.idFromName("single-ledger"));
   const result=await rehearseUnifiedSession({
    request,env:{
     LAB_ALLOWED_ORIGIN:"https://lab.example.test",
     LAB_ACCESS_TOKEN:"synthetic-local-only-token-0123456789abcdef",
     MOCK_LAB_ENABLED:true
    },
    ledgerStub:stub,
    mockProvider:async()=> "v=0\\r\\nm=audio 9 UDP/TLS/RTP/SAVPF 111\\r\\n"
   });
   return Response.json(result,{status:result.status||500});
  }
  // Test-only route; never deploy this harness publicly.
  if(!["/__local/reserve","/__local/release"].includes(url.pathname) || request.method!=="POST")
   return Response.json({error:"not_found"},{status:404});
  if(request.headers.get("x-local-test")!=="infinity-voice-v11")
   return Response.json({error:"forbidden"},{status:403});
  const stub=env.LAB_LEDGER.get(env.LAB_LEDGER.idFromName("single-ledger"));
  return stub.fetch(new Request("https://internal.invalid/internal/"+(url.pathname.endsWith("release")?"release":"reserve"),{method:"POST",headers:{"Content-Type":"application/json"},body:url.pathname.endsWith("release")?await request.text():undefined}));
 }
};
