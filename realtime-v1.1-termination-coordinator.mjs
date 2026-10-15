/** Offline-only lifecycle: hang up at provider before releasing DO reservation.
 * Caller must authenticate and own the call; never expose this directly to clients.
 * A 200 hangup response is a provider API acknowledgement, not a billing guarantee.
 */
import {hangupRealtimeCall} from "./realtime-v1.1-hangup-candidate.mjs";
export async function terminateAndRelease({callId,reservationId,apiKey,transport,ledgerStub,releaseToken,claimId,providerEnabled=false}={}){
 if(!ledgerStub||typeof ledgerStub.fetch!=="function")return {ok:false,status:503,error:"ledger_unavailable"};
 if(typeof reservationId!=="string"||!/^[-a-f0-9]{36}$/i.test(reservationId))
  return {ok:false,status:400,error:"invalid_reservation_id"};
 if(typeof claimId!=="string"||claimId.length<16)
  return {ok:false,status:409,error:"termination_claim_required",releaseAttempted:false};
 const ended=await hangupRealtimeCall({callId,apiKey,transport,providerEnabled});
 if(!ended.ok)return {ok:false,status:ended.status,error:ended.error,releaseAttempted:false};
 try{
  const response=await ledgerStub.fetch(new Request("https://internal.invalid/internal/release",{
   method:"POST",headers:{"content-type":"application/json",...(releaseToken?{"x-internal-release-token":releaseToken}:{})},body:JSON.stringify({reservationId,callId,claimId,providerAcknowledged:true})
  }));
  if(!response.ok)return {ok:false,status:503,error:"release_unconfirmed",providerAcknowledged:true};
  const data=await response.json();
  if(data?.released!==true)return {ok:false,status:503,error:"release_unconfirmed",providerAcknowledged:true};
  return {ok:true,status:200,providerAcknowledged:true,released:true};
 }catch{return {ok:false,status:503,error:"release_unconfirmed",providerAcknowledged:true}}
}
