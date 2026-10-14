/**
 * Realtime session lifecycle coordinator — laboratory candidate.
 * Does not mint tokens, call OpenAI or claim to terminate paid sessions.
 * The session reservation must be released only after a verified provider
 * termination or after expiry; browser "stop" alone is insufficient.
 */
export function planSessionShutdown({reservationId,providerSessionId,providerTerminationConfirmed=false}={}){
 if(typeof reservationId!=="string"||!reservationId)return {ok:false,error:"missing_reservation"};
 if(typeof providerSessionId!=="string"||!providerSessionId)return {ok:false,error:"missing_provider_session"};
 if(!providerTerminationConfirmed)return {ok:false,error:"termination_unverified",releaseAllowed:false};
 return {ok:true,releaseAllowed:true,reservationId};
}
export function validateBudgetGate({hardProviderCapVerified=false,serverTerminationVerified=false,priceModelVerified=false}={}){
 const missing=[];
 if(!hardProviderCapVerified)missing.push("hard_provider_cap");
 if(!serverTerminationVerified)missing.push("server_termination");
 if(!priceModelVerified)missing.push("price_model");
 return {canEnable:missing.length===0,missing};
}
