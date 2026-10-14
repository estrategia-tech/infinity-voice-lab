// Infinity Voice Lab v0.8.1 — isolated security candidate. NO OpenAI calls.
const VERSION = '0.8.1-security-candidate';
const ORIGIN = 'https://estrategia-tech.github.io';
const encoder = new TextEncoder();
function respond(data, status = 200, origin = '') {
  const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'};
  if (origin === ORIGIN) headers['Access-Control-Allow-Origin'] = ORIGIN;
  return new Response(JSON.stringify(data),{status,headers});
}
function constantEqual(a,b) {
  if(typeof a!=='string'||typeof b!=='string')return false;
  const x=encoder.encode(a),y=encoder.encode(b);let diff=x.length^y.length;
  for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);
  return diff===0;
}
export class VoiceQuota {
  constructor(ctx){this.ctx=ctx;}
  async fetch(request){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const now=Date.now(),minute=60_000,day=86_400_000;
      const state=(await this.ctx.storage.get('quota'))||{recent:[],daily:[]};
      state.recent=state.recent.filter(t=>t>now-minute);
      state.daily=state.daily.filter(t=>t>now-day);
      if(state.recent.length>=5||state.daily.length>=25){await this.ctx.storage.put('quota',state);return respond({error:'quota_exceeded'},429);}
      state.recent.push(now);state.daily.push(now);
      await this.ctx.storage.put('quota',state);
      return respond({allowed:true,remaining_minute:5-state.recent.length,remaining_day:25-state.daily.length});
    });
  }
}
export default {
  async fetch(request,env){
    const url=new URL(request.url),path=url.pathname,origin=request.headers.get('Origin')||'';
    const send=(data,status=200)=>respond(data,status,origin);
    if(request.method==='OPTIONS'){
      if(origin!==ORIGIN)return send({error:'origin_denied'},403);
      return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'}});
    }
    if(path==='/health'&&request.method==='GET')return send({service:'infinity-voice-lab',version:VERSION,mode:'laboratory',ai_enabled:false});
    if(path!=='/api/chat')return send({error:'not_found'},404);
    if(request.method!=='POST')return send({error:'method_not_allowed'},405);
    if(origin && origin!==ORIGIN)return send({error:'origin_denied'},403);
    if(typeof env?.LAB_ACCESS_TOKEN!=='string'||env.LAB_ACCESS_TOKEN.length<32)return send({error:'security_not_configured'},503);
    const bearer=request.headers.get('Authorization')||'';
    if(!bearer.startsWith('Bearer ')||!constantEqual(bearer.slice(7),env.LAB_ACCESS_TOKEN))return send({error:'unauthorized'},401);
    if(!env.VOICE_QUOTA)return send({error:'quota_storage_not_configured'},503);
    if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return send({error:'json_required'},415);
    let payload;try{payload=await request.json()}catch{return send({error:'invalid_json'},400)}
    if(typeof payload?.message!=='string'||payload.message.trim().length===0||payload.message.length>500)return send({error:'invalid_message'},400);
    const id=env.VOICE_QUOTA.idFromName('single-lab-operator');
    const quota=await env.VOICE_QUOTA.get(id).fetch('https://quota.internal/check',{method:'POST'});
    if(!quota.ok)return send({error:'quota_exceeded'},quota.status===429?429:503);
    // Security gate only. No OpenAI API invocation, no session activation, no costs.
    return send({error:'ai_disabled',message:'Controles de seguridad activos; OpenAI aún no está conectado.',ai_enabled:false},403);
  }
};
