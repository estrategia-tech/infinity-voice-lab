/** Offline-only authorization contract. No real tokens or cryptography; fail closed. */
export function validateTransportCapability(capability,{now,requiredScope="voice:mock"}={}){
 if(!capability||typeof capability!=="object"||Array.isArray(capability)||
 Object.keys(capability).some(k=>!["scope","expiresAt","sessionId","issuer"].includes(k))||
 capability.issuer!=="local-test-only"||capability.scope!==requiredScope||
 typeof capability.sessionId!=="string"||!/^mock_[a-zA-Z0-9_-]{8,64}$/.test(capability.sessionId)||
 !Number.isSafeInteger(capability.expiresAt)||!Number.isSafeInteger(now)||now<0||
 capability.expiresAt<=now||capability.expiresAt-now>60000)
 return {ok:false,error:"capability_denied"};
 return {ok:true,sessionId:capability.sessionId};
}
export function authorizeMockFrame(capability,frame,context){
 const auth=validateTransportCapability(capability,context);
 if(!auth.ok)return auth;
 if(!frame||frame.sessionId!==auth.sessionId||
 Object.keys(frame).some(k=>!["sessionId","sequence","type"].includes(k)))
 return {ok:false,error:"frame_scope_denied"};
 return {ok:true};
}
