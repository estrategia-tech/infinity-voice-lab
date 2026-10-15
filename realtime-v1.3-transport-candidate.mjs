/** Stage 3: offline-only transport state machine. No sockets, fetch, provider or credentials. */
const STATES=Object.freeze(["disconnected","connecting","connected","interrupted","closed"]);
const NEXT=Object.freeze({
 disconnected:{connect:"connecting",close:"closed"},
 connecting:{connected:"connected",failure:"interrupted",close:"closed"},
 connected:{drop:"interrupted",close:"closed"},
 interrupted:{retry:"connecting",close:"closed"},
 closed:{}
});
export function createMockTransport({maxRetries=2}={}){
 if(!Number.isSafeInteger(maxRetries)||maxRetries<0||maxRetries>5)return {ok:false,error:"invalid_retry_limit"};
 return {ok:true,transport:Object.freeze({state:"disconnected",retries:0,maxRetries,sequence:0})};
}
export function transitionTransport(transport,event){
 if(!transport||!STATES.includes(transport.state)||!Object.hasOwn(NEXT[transport.state],event))
  return {ok:false,error:"transition_denied"};
 if(event==="retry"&&transport.retries>=transport.maxRetries)
  return {ok:false,error:"retry_limit"};
 const retries=event==="retry"?transport.retries+1:transport.retries;
 return {ok:true,transport:Object.freeze({...transport,state:NEXT[transport.state][event],retries})};
}
export function sendMockFrame(transport,frame){
 if(!transport||transport.state!=="connected")return {ok:false,error:"transport_not_connected"};
 if(!frame||typeof frame!=="object"||Array.isArray(frame)||
  Object.keys(frame).some(k=>!["sequence","type"].includes(k))||
  !Number.isSafeInteger(frame.sequence)||frame.sequence!==transport.sequence+1||
  !["audio_metadata","control"].includes(frame.type))
  return {ok:false,error:"invalid_frame"};
 return {ok:true,transport:Object.freeze({...transport,sequence:frame.sequence}),
  receipt:Object.freeze({sequence:frame.sequence,accepted:true})};
}
