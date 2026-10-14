/** Offline-only SDP validation and request preparation; NEVER calls OpenAI. */
export function validateSdpOffer(value){
 if(typeof value!=="string"||value.length<20||value.length>32768)return {ok:false,error:"invalid_sdp"};
 if(!value.startsWith("v=0")||!/(^|\r?\n)m=audio\s/m.test(value))return {ok:false,error:"invalid_sdp"};
 if(/[\u0000]/.test(value))return {ok:false,error:"invalid_sdp"};
 return {ok:true};
}
export function prepareUnifiedOffer({sdp,model="gpt-realtime-2.1",voice="marin"}={}){
 const validation=validateSdpOffer(sdp);
 if(!validation.ok)return validation;
 if(model!=="gpt-realtime-2.1"||voice!=="marin")return {ok:false,error:"unsupported_configuration"};
 const session=JSON.stringify({type:"realtime",model,audio:{output:{voice}}});
 return {ok:true,session,sdp};
}
