/**
 * Offline-only end-to-end admission rehearsal. Never imports a provider client.
 * A successful mock returns a synthetic answer, NOT an OpenAI session.
 */
import {checkLabAccess} from "./realtime-v1.1-access.mjs";
import {prepareUnifiedOffer} from "./realtime-v1.1-unified-offer.mjs";
import {reserveForLab} from "./realtime-v1.1-admission-candidate.mjs";
const fail=(status,error)=>({ok:false,status,error});
export async function rehearseUnifiedSession({request,env={},ledgerStub,mockProvider}={}){
 if(!request)return fail(400,"invalid_request");
 const access=checkLabAccess(request,env);
 if(!access.ok)return fail(access.status,access.error);
 if(env.MOCK_LAB_ENABLED!==true)return fail(403,"mock_disabled");
 if(typeof mockProvider!=="function")return fail(503,"mock_unavailable");
 let sdp;
 try{
  if(Number(request.headers.get("content-length"))>32768)return fail(413,"offer_too_large");
  sdp=await request.text();
  if(new TextEncoder().encode(sdp).byteLength>32768)return fail(413,"offer_too_large");
 }catch{return fail(400,"invalid_request")}
 const offer=prepareUnifiedOffer({sdp});
 if(!offer.ok)return fail(400,offer.error);
 const admitted=await reserveForLab({ledgerStub,enabled:true});
 if(!admitted.ok)return admitted;
 try{
  const result=await mockProvider({sdp:offer.sdp,session:offer.session});
  if(typeof result!=="string"||!result.startsWith("v=0"))throw Error("invalid mock answer");
  return {ok:true,mock:true,status:200,reservation:admitted.reservation,answer:result};
 }catch{
  // Mock failures do not consume concurrency; daily attempt remains charged.
  try{
   const releaseResponse=await ledgerStub.fetch(new Request("https://internal.invalid/internal/release",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({reservationId:admitted.reservation.reservationId})
   }));
   if(!releaseResponse.ok)return fail(503,"mock_failed_release_unverified");
   const releaseBody=await releaseResponse.json();
   if(releaseBody?.released!==true)return fail(503,"mock_failed_release_unverified");
  }catch{return fail(503,"mock_failed_release_unverified")}
  return fail(502,"mock_failed");
 }
}
