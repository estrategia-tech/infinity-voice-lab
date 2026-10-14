/** Offline-only: atomic ownership claim before provider hangup. */
import {hangupRealtimeCall} from "./realtime-v1.1-hangup-candidate.mjs";
export async function terminateClaimedCall({ledgerStub,reservationId,callId,releaseToken,
 apiKey,transport,providerEnabled=false}={}){
 if(!providerEnabled)return {ok:false,status:403,error:"provider_disabled"};
 if(!ledgerStub||typeof ledgerStub.fetch!=="function")
  return {ok:false,status:503,error:"ledger_unavailable"};
 if(typeof releaseToken!=="string"||releaseToken.length<32)
  return {ok:false,status:403,error:"capability_missing"};
 const post=async(path,body)=>ledgerStub.fetch(new Request("https://internal.invalid/internal/"+path,{
  method:"POST",headers:{"content-type":"application/json","x-internal-release-token":releaseToken},
  body:JSON.stringify(body)
 }));
 let claim;
 try{
  const r=await post("claim-termination",{reservationId,callId});
  if(!r.ok)return {ok:false,status:r.status,error:(await r.json()).error??"claim_failed"};
  claim=await r.json();
  if(!claim?.claimed||!claim.claimId)return {ok:false,status:503,error:"claim_unconfirmed"};
 }catch{return {ok:false,status:503,error:"claim_unavailable"}}
 let ended;
 try{ended=await hangupRealtimeCall({callId,apiKey,transport,providerEnabled})}
 catch{ended={ok:false,status:503,error:"hangup_exception"}}
 try{
  const r=await post("finish-termination",{reservationId,callId,claimId:claim.claimId,
   providerAcknowledged:ended.ok===true});
  if(!r.ok)return {ok:false,status:503,error:"finish_unconfirmed",requiresReview:true};
  const data=await r.json();
  if(!ended.ok)return {ok:false,status:ended.status,error:ended.error??"hangup_unconfirmed",requiresReview:true};
  if(data.released!==true)return {ok:false,status:503,error:"release_unconfirmed",requiresReview:true};
  return {ok:true,status:200,released:true,providerAcknowledged:true};
 }catch{return {ok:false,status:503,error:"finish_unavailable",requiresReview:true}}
}
