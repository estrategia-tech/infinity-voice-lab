/** Offline-only expiration coordinator. A scheduled server alarm must call this;
 * this module does NOT install an alarm or create an OpenAI call.
 * Expired reservations MUST NOT be assumed to have ended provider sessions.
 */
import {terminateAndRelease} from "./realtime-v1.1-termination-coordinator.mjs";
const validId=x=>typeof x==="string"&&/^[-a-f0-9]{36}$/i.test(x);
export async function expireBoundCall({binding,now=Date.now(),apiKey,transport,ledgerStub,releaseToken,providerEnabled=false}={}){
 if(!binding||!validId(binding.reservationId)||!Number.isSafeInteger(binding.expiresAt)||
    typeof binding.callId!=="string"||!/^rtc_[A-Za-z0-9_-]{6,128}$/.test(binding.callId))
  return {ok:false,status:400,error:"invalid_binding"};
 if(now<binding.expiresAt)return {ok:false,status:409,error:"not_expired"};
 return terminateAndRelease({callId:binding.callId,reservationId:binding.reservationId,
  apiKey,transport,ledgerStub,releaseToken,providerEnabled});
}
export function createTimeoutBinding({reservation,callId}={}){
 if(!validId(reservation?.reservationId)||!Number.isSafeInteger(reservation?.expiresAt)||
    !/^rtc_[A-Za-z0-9_-]{6,128}$/.test(callId??""))
  return {ok:false,error:"invalid_binding"};
 return {ok:true,binding:{reservationId:reservation.reservationId,callId,expiresAt:reservation.expiresAt}};
}
