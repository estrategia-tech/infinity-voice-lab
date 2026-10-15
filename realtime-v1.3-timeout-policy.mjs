/** Pure offline clock-driven timeout policy. Never releases capacity or calls a provider. */
export function createTimeoutPolicy({connectMs=5000,idleMs=15000,maxRetries=2}={}){
 if(!Number.isSafeInteger(connectMs)||connectMs<100||connectMs>60000||
 !Number.isSafeInteger(idleMs)||idleMs<100||idleMs>120000||
 !Number.isSafeInteger(maxRetries)||maxRetries<0||maxRetries>5)
 return {ok:false,error:"invalid_timeout_policy"};
 return {ok:true,policy:Object.freeze({connectMs,idleMs,maxRetries})};
}
export function evaluateTransportTimeout({transport,policy,now,lastActivityAt,connectedAt}={}){
 if(!transport||!policy||!Number.isSafeInteger(now)||now<0||
 !Number.isSafeInteger(lastActivityAt)||lastActivityAt<0||lastActivityAt>now)
 return {ok:false,error:"invalid_clock"};
 if(transport.state==="connecting"){
  if(!Number.isSafeInteger(connectedAt)||connectedAt<0||connectedAt>now)
   return {ok:false,error:"invalid_clock"};
  return {ok:true,action:now-connectedAt>=policy.connectMs?"interrupt":"wait"};
 }
 if(transport.state==="connected")
  return {ok:true,action:now-lastActivityAt>=policy.idleMs?"interrupt":"wait"};
 if(transport.state==="interrupted")
  return {ok:true,action:transport.retries>=policy.maxRetries?"manual_review":"retry_eligible"};
 return {ok:true,action:"none"};
}
