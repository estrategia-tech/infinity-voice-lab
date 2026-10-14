/**
 * Read-only offline reconciliation. Never releases a reservation, calls a
 * provider, schedules alarms or trusts a mock termination as provider proof.
 * Stubs must be trusted internal Durable Object bindings, not public URLs.
 */
const read=async(stub)=>{
 if(!stub||typeof stub.fetch!=="function")throw Error("internal_stub_unavailable");
 const r=await stub.fetch(new Request("https://internal.invalid/internal/status",{method:"POST"}));
 if(!r.ok)throw Error("internal_status_unavailable");
 return r.json();
};
export async function reconcileLabState({ledgerStub,alarmStub,now=Date.now()}={}){
 try{
  const ledger=await read(ledgerStub),alarm=await read(alarmStub);
  if(!Array.isArray(ledger?.reservations)||!("binding" in alarm))throw Error("invalid_status");
  const binding=alarm.binding;
  const results=ledger.reservations.map(reservation=>{
   const match=binding?.reservationId===reservation.reservationId &&
    binding?.callId===reservation.callId && Boolean(reservation.callId);
   const expired=reservation.expiresAt<=now;
   const status=reservation.status==="termination_claimed"?"termination_claimed":
    reservation.status==="termination_uncertain"?"termination_uncertain":
    reservation.status==="alarm_schedule_failed"?"alarm_schedule_failed":
    reservation.status==="expired_unterminated"?"expired_unterminated":
    !reservation.callId?"unbound_reservation":
    !match?"alarm_binding_missing_or_mismatched":
    binding.status==="mock_terminated"?"mock_termination_not_provider_proof":
    binding.status==="mock_termination_failed"?"mock_termination_failed":
    binding.status==="expired_unterminated"?"expired_unterminated":
    expired?"expired_unverified":"pending";
   return {reservationId:reservation.reservationId,callId:reservation.callId??null,
    expired,status,requiresReview:status!=="pending"};
  });
  const orphanAlarm=Boolean(binding&&!ledger.reservations.some(r=>
   r.reservationId===binding.reservationId&&r.callId===binding.callId));
  return {ok:true,readOnly:true,providerVerified:false,autoReleased:false,
   results,orphanAlarm,requiresReview:orphanAlarm||results.some(r=>r.requiresReview)};
 }catch{
  return {ok:false,readOnly:true,providerVerified:false,autoReleased:false,
   error:"reconciliation_unavailable",requiresReview:true};
 }
}
