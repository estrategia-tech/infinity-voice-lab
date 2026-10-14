/** Offline-injected hangup adapter. No real network unless a future caller explicitly
 * supplies a transport AND enables provider calls after independent approval.
 * Never expose this function directly as an unauthenticated public endpoint.
 */
const validId=id=>typeof id==="string"&&/^rtc_[A-Za-z0-9_-]{6,128}$/.test(id);
export async function hangupRealtimeCall({callId,apiKey,transport,providerEnabled=false}={}){
 if(!validId(callId))return {ok:false,status:400,error:"invalid_call_id"};
 if(!providerEnabled)return {ok:false,status:403,error:"provider_disabled"};
 if(typeof apiKey!=="string"||apiKey.length<16||typeof transport!=="function")
  return {ok:false,status:503,error:"provider_not_configured"};
 const url="https://api.openai.com/v1/realtime/calls/"+encodeURIComponent(callId)+"/hangup";
 try{
  const response=await transport(url,{method:"POST",headers:{Authorization:"Bearer "+apiKey},signal:AbortSignal.timeout(5000)});
  if(!response?.ok)return {ok:false,status:502,error:"hangup_unconfirmed",providerStatus:response?.status??null};
  return {ok:true,status:200,providerConfirmed:true};
 }catch{return {ok:false,status:503,error:"hangup_unconfirmed"}}
}
