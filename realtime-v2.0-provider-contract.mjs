/** Design-only provider boundary. No sockets, fetch, credentials or paid calls. */
const EVENTS=new Set(["session_open_requested","session_open_confirmed","session_close_requested","session_close_confirmed","session_failed"]);
const allowed=new Set(["event","sessionId","sequence","providerReceipt"]);
export function validateProviderEvent(event){
 if(!event||typeof event!=="object"||Array.isArray(event)||Object.keys(event).some(k=>!allowed.has(k)))return {ok:false,error:"invalid_event_shape"};
 if(!EVENTS.has(event.event)||typeof event.sessionId!=="string"||!/^mock_[a-zA-Z0-9_-]{8,64}$/.test(event.sessionId)||!Number.isSafeInteger(event.sequence)||event.sequence<1)return {ok:false,error:"invalid_event"};
 if(event.providerReceipt!==undefined&&(event.event!=="session_close_confirmed"||event.providerReceipt!=="mock-only-confirmation"))return {ok:false,error:"untrusted_receipt"};
 return {ok:true,event:Object.freeze({...event})};
}
export function createOfflineProviderAdapter({sessionId}={}){
 if(typeof sessionId!=="string"||!/^mock_[a-zA-Z0-9_-]{8,64}$/.test(sessionId))return {ok:false,error:"invalid_session"};
 return {ok:true,adapter:Object.freeze({sessionId,sequence:0,status:"idle",providerConfirmedClose:false})};
}
export function applyOfflineProviderEvent(adapter,raw){
 if(!adapter)return {ok:false,error:"invalid_adapter"};
 const checked=validateProviderEvent(raw);if(!checked.ok)return checked;
 const e=checked.event;
 if(e.sessionId!==adapter.sessionId||e.sequence!==adapter.sequence+1)return {ok:false,error:"session_or_sequence_mismatch"};
 const transitions={idle:{session_open_requested:"opening"},opening:{session_open_confirmed:"open",session_failed:"failed"},open:{session_close_requested:"closing",session_failed:"failed"},closing:{session_close_confirmed:"closed",session_failed:"failed"}};
 const status=transitions[adapter.status]?.[e.event];
 if(!status)return {ok:false,error:"invalid_transition"};
 if(e.event==="session_close_confirmed"&&e.providerReceipt!=="mock-only-confirmation")return {ok:false,error:"missing_mock_receipt"};
 return {ok:true,adapter:Object.freeze({...adapter,sequence:e.sequence,status,providerConfirmedClose:status==="closed"&&e.providerReceipt==="mock-only-confirmation"})};
}
