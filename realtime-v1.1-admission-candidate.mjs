/**
 * Infinity Voice v1.1 isolated admission coordinator.
 * Internal-only reservation wiring. It NEVER creates an OpenAI session.
 * The caller must supply a Durable Object stub from a trusted server binding.
 */
export async function reserveForLab({ledgerStub, enabled=false}={}){
 if(!enabled) return {ok:false,status:403,error:"realtime_disabled"};
 if(!ledgerStub || typeof ledgerStub.fetch!=="function")
  return {ok:false,status:503,error:"ledger_unavailable"};
 try {
  const response=await ledgerStub.fetch(new Request("https://internal.invalid/internal/reserve",{method:"POST"}));
  if(!response.ok) return {ok:false,status:response.status,error:"reservation_rejected"};
  const data=await response.json();
  if(typeof data.reservationId!=="string" || !Number.isFinite(data.expiresAt) || !Number.isFinite(data.maxSeconds))
   return {ok:false,status:503,error:"invalid_reservation"};
  return {ok:true,reservation:data};
 }catch{
  return {ok:false,status:503,error:"ledger_unavailable"};
 }
}
