// Infinity Voice v0.9 candidate. Fail closed; never store keys in client code.
const ORIGIN='https://estrategia-tech.github.io';
const MAX_OUTPUT=160;
const MODEL='gpt-4o-mini';
const headers=(origin)=>({'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','vary':'Origin',...(origin===ORIGIN?{'access-control-allow-origin':ORIGIN}:{})});
const json=(body,status=200,origin='')=>new Response(JSON.stringify(body),{status,headers:headers(origin)});
const eq=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x[i]||0)^(y[i]||0);return d===0;};
export class VoiceQuota {
  constructor(ctx){this.ctx=ctx;}
  async fetch(){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const now=Date.now();const s=await this.ctx.storage.get('quota')||{minute:[],day:[]};
      s.minute=s.minute.filter(t=>t>now-60000);s.day=s.day.filter(t=>t>now-86400000);
      if(s.minute.length>=5||s.day.length>=25)return json({error:'quota_exceeded'},429);
      s.minute.push(now);s.day.push(now);await this.ctx.storage.put('quota',s);
      return json({allowed:true,remaining_minute:5-s.minute.length,remaining_day:25-s.day.length});
    });
  }
}
export default {
  async fetch(request,env){
    const url=new URL(request.url),origin=request.headers.get('Origin')||'';
    if(request.method==='GET'&&url.pathname==='/health')return json({service:'infinity-voice-lab',version:'0.9.0-candidate',mode:'laboratory',ai_enabled:env?.VOICE_AI_ENABLED==='true'&&Boolean(env?.OPENAI_API_KEY)},200,origin);
    if(url.pathname!=='/api/chat')return json({error:'not_found'},404,origin);
    if(request.method==='OPTIONS'){
      if(origin!==ORIGIN)return json({error:'origin_denied'},403,origin);
      return new Response(null,{status:204,headers:{'access-control-allow-origin':ORIGIN,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'Authorization, Content-Type','access-control-max-age':'600','vary':'Origin'}});
    }
    if(request.method!=='POST')return json({error:'method_not_allowed'},405,origin);
    if(origin!==ORIGIN)return json({error:'origin_denied'},403,origin);
    if(typeof env?.LAB_ACCESS_TOKEN!=='string'||env.LAB_ACCESS_TOKEN.length<32)return json({error:'security_not_configured'},503,origin);
    const auth=request.headers.get('Authorization')||'';
    if(!auth.startsWith('Bearer ')||!eq(auth.slice(7),env.LAB_ACCESS_TOKEN))return json({error:'unauthorized'},401,origin);
    if(env?.VOICE_AI_ENABLED!=='true')return json({error:'ai_disabled'},403,origin);
    if(typeof env?.OPENAI_API_KEY!=='string'||!env.OPENAI_API_KEY.startsWith('sk-'))return json({error:'openai_not_configured'},503,origin);
    if(!env.VOICE_QUOTA)return json({error:'quota_not_configured'},503,origin);
    if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json({error:'json_required'},415,origin);
    let payload;try{payload=await request.json()}catch{return json({error:'invalid_json'},400,origin)}
    if(typeof payload?.message!=='string'||!payload.message.trim()||payload.message.length>500)return json({error:'invalid_message'},400,origin);
    const quota=await env.VOICE_QUOTA.get(env.VOICE_QUOTA.idFromName('single-lab-operator')).fetch('https://quota.internal/check',{method:'POST'});
    if(!quota.ok)return json({error:quota.status===429?'quota_exceeded':'quota_unavailable'},quota.status===429?429:503,origin);
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const upstream=await fetch('https://api.openai.com/v1/responses',{
        method:'POST',signal:controller.signal,
        headers:{'authorization':`Bearer ${env.OPENAI_API_KEY}`,'content-type':'application/json'},
        body:JSON.stringify({model:MODEL,store:false,max_output_tokens:MAX_OUTPUT,instructions:'Eres Infinity Voice, un asistente de laboratorio de Infinity Living. Responde en español de México, de manera breve, cálida y clara. No inventes precios, inventarios, rendimientos ni información inmobiliaria.',input:payload.message.trim()})
      });
      if(!upstream.ok)return json({error:'ai_provider_unavailable'},502,origin);
      const data=await upstream.json();
      const answer=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text||'').join(' ').trim();
      if(!answer)return json({error:'empty_ai_response'},502,origin);
      return json({answer:answer.slice(0,1200),model:MODEL},200,origin);
    }catch{return json({error:'ai_request_failed'},502,origin)}finally{clearTimeout(timer)}
  }
};
