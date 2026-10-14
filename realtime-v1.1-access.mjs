/**
 * Realtime v1.1 laboratory access guard. No credentials are minted.
 * Caller must enforce HTTPS, durable quotas and paid-session kill switch separately.
 */
const encode=new TextEncoder();
export function equalSecret(a,b){
 if(typeof a!=="string"||typeof b!=="string"||!a||!b)return false;
 const aa=encode.encode(a),bb=encode.encode(b);
 let diff=aa.length^bb.length;
 const size=Math.max(aa.length,bb.length);
 for(let i=0;i<size;i++)diff|=(aa[i]||0)^(bb[i]||0);
 return diff===0;
}
export function checkLabAccess(request,env={}){
 const allowed=env.LAB_ALLOWED_ORIGIN;
 const secret=env.LAB_ACCESS_TOKEN;
 if(typeof allowed!=="string"||!/^https:\/\//.test(allowed)||typeof secret!=="string"||secret.length<32)
  return {ok:false,status:503,error:"lab_not_configured"};
 const origin=request.headers.get("origin");
 if(origin!==allowed)return {ok:false,status:403,error:"origin_denied"};
 const auth=request.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer ")||!equalSecret(auth.slice(7),secret))
  return {ok:false,status:401,error:"unauthorized"};
 return {ok:true};
}
