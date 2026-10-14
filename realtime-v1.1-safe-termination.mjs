/**
 * Strict offline candidate: verify the reservation owns the call before
 * asking a provider to hang up. No public route or real provider is wired.
 * The trusted ledger stub must be a private Durable Object binding.
 */
import {terminateAndRelease} from "./realtime-v1.1-termination-coordinator.mjs";
export async function safeTerminateBoundCall(options={}){
 const {reservationId,callId,ledgerStub}=options;
 if(typeof reservationId!=="string"||!/^[-a-f0-9]{36}$/i.test(reservationId)||
    typeof callId!=="string"||!/^rtc_[A-Za-z0-9_-]{6,128}$/.test(callId))
  return {ok:false,status:400,error:"invalid_binding",releaseAttempted:false};
 if(!ledgerStub||typeof ledgerStub.fetch!=="function")
  return {ok:false,status:503,error:"ledger_unavailable",releaseAttempted:false};
 try{
  const response=await ledgerStub.fetch(new Request("https://internal.invalid/internal/status",{method:"POST"}));
  if(!response.ok)return {ok:false,status:503,error:"binding_unverified",releaseAttempted:false};
  const data=await response.json();
  if(!Array.isArray(data?.reservations))
   return {ok:false,status:503,error:"binding_unverified",releaseAttempted:false};
  const match=data.reservations.filter(r=>r.reservationId===reservationId);
  if(match.length!==1||match[0].callId!==callId)
   return {ok:false,status:409,error:"binding_mismatch",releaseAttempted:false};
  if(!["pending","expired_unterminated","alarm_schedule_failed"].includes(match[0].status))
   return {ok:false,status:409,error:"binding_invalid_state",releaseAttempted:false};
 }catch{return {ok:false,status:503,error:"binding_unverified",releaseAttempted:false}}
 return terminateAndRelease(options);
}
