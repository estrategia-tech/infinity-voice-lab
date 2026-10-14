/**
 * Authoritative offline-only reconciliation of the primary reservation DO.
 * No provider calls, release, alarm mutations, or public routes.
 */
export async function reconcilePrimaryLedger({ledgerStub,now=Date.now()}={}){
 try{
  if(!ledgerStub||typeof ledgerStub.fetch!=="function")throw Error("ledger_unavailable");
  const response=await ledgerStub.fetch(new Request("https://internal.invalid/internal/status",{method:"POST"}));
  if(!response.ok)throw Error("ledger_status_failed");
  const data=await response.json();
  if(!Array.isArray(data?.reservations))throw Error("invalid_ledger_status");
  const seen=new Set();
  const results=data.reservations.map(s=>{
   if(typeof s?.reservationId!=="string"||!/^[-a-f0-9]{36}$/i.test(s.reservationId)||
      !Number.isSafeInteger(s.expiresAt)||seen.has(s.reservationId)||
      (s.callId!==null&&s.callId!==undefined&&!/^rtc_[A-Za-z0-9_-]{6,128}$/.test(s.callId)))
     throw Error("invalid_reservation");
   seen.add(s.reservationId);
   const expired=s.expiresAt<=now;
   const status=s.status==="alarm_schedule_failed"?"alarm_schedule_failed":
    s.status==="expired_unterminated"?"expired_unterminated":
    !s.callId?(expired?"expired_unbound":"unbound_reservation"):
    expired?"expired_unverified":
    s.status==="pending"?"pending":"unknown_binding_state";
   return {reservationId:s.reservationId,callId:s.callId??null,expired,status,
    requiresReview:status!=="pending"};
  });
  return {ok:true,source:"primary_ledger",readOnly:true,providerVerified:false,
   autoReleased:false,results,requiresReview:results.some(r=>r.requiresReview)};
 }catch{
  return {ok:false,source:"primary_ledger",readOnly:true,providerVerified:false,
   autoReleased:false,error:"reconciliation_unavailable",requiresReview:true};
 }
}
