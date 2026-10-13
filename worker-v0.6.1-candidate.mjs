// Infinity Voice Lab 0.6.1: protected, stateful lab-only lease. NO OpenAI connection.
const VERSION = '0.6.1-candidate';
const ORIGIN = 'https://estrategia-tech.github.io';
const MAX_MS = 180_000;
const MAX_STARTS_PER_HOUR = 10;
const MAX_REQUESTS_PER_MINUTE = 30;
const enc = new TextEncoder();
function json(data, status = 200, origin = null) {
  const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'};
  if (origin === ORIGIN) headers['Access-Control-Allow-Origin'] = ORIGIN;
  return new Response(JSON.stringify(data), {status, headers});
}
function equal(a,b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x=enc.encode(a),y=enc.encode(b); let diff=x.length^y.length;
  for(let i=0;i<Math.max(x.length,y.length);i++) diff|=(x[i]||0)^(y[i]||0);
  return diff===0;
}
function authorized(request, env) {
  const secret=env?.LAB_ACCESS_TOKEN;
  if(typeof secret!=='string'||secret.length<32) return null;
  const header=request.headers.get('Authorization')||'';
  return header.startsWith('Bearer ') && equal(header.slice(7),secret);
}
export class LabSessionCoordinator {
  constructor(ctx) { this.ctx=ctx; }
  async fetch(request) {
    return this.ctx.blockConcurrencyWhile(async()=>{
      const now=Date.now();
      const url=new URL(request.url); const action=url.pathname;
      const record=(await this.ctx.storage.get('record'))||{session:null,starts:[],requests:[]};
      record.starts=record.starts.filter(t=>t>now-3_600_000);
      record.requests=record.requests.filter(t=>t>now-60_000);
      if(record.session && record.session.expiresAt<=now) record.session=null;
      if(record.requests.length>=MAX_REQUESTS_PER_MINUTE) return json({error:'rate_limited'},429);
      record.requests.push(now);
      let data,status=200;
      if(action==='/start' && request.method==='POST') {
        if(record.session) {data={error:'session_already_active'};status=409;}
        else if(record.starts.length>=MAX_STARTS_PER_HOUR) {data={error:'start_limit_reached'};status=429;}
        else {
          const id=crypto.randomUUID();
          record.session={id,createdAt:now,expiresAt:now+MAX_MS};
          record.starts.push(now);
          data={session_id:id,expires_at:new Date(now+MAX_MS).toISOString(),max_duration_seconds:180,mode:'laboratory',openai_sessions_enabled:false};
          status=201;
        }
      } else if(action==='/status' && request.method==='GET') {
        data={active:!!record.session,remaining_seconds:record.session?Math.max(0,Math.ceil((record.session.expiresAt-now)/1000)):0,openai_sessions_enabled:false};
      } else if(action==='/end' && request.method==='POST') {
        if(!record.session) {data={error:'no_active_session'};status=404;}
        else {record.session=null;data={ended:true};}
      } else {data={error:'not_found'};status=404;}
      await this.ctx.storage.put('record',record);
      return json(data,status);
    });
  }
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);const path=url.pathname.replace(/\/+$/,'')||'/';
    const origin=request.headers.get('Origin');const send=(data,status=200)=>json(data,status,origin);
    if(request.method==='OPTIONS') return send({error:'method_not_allowed'},405);
    if(path==='/health'&&request.method==='GET') return send({service:'infinity-voice-api-lab',version:VERSION,status:'operational',mode:'laboratory',openai_sessions_enabled:false});
    if(path==='/health') return send({error:'method_not_allowed'},405);
    // Explicitly deny all real OpenAI/session endpoints, including legacy names.
    if(/(^|\/)(session|sessions|realtime|openai)(\/|$)/i.test(path)) return send({error:'sessions_disabled'},403);
    if(path==='/security'||path.startsWith('/lab/')) {
      if(typeof env?.LAB_ACCESS_TOKEN!=='string'||env.LAB_ACCESS_TOKEN.length<32) return send({error:'security_not_configured'},503);
      if(!authorized(request,env)) return send({error:'unauthorized'},401);
      if(path==='/security') return request.method==='GET'?send({authenticated:true,version:VERSION,openai_sessions_enabled:false}):send({error:'method_not_allowed'},405);
      const routes={'/lab/start':['POST','/start'],'/lab/status':['GET','/status'],'/lab/end':['POST','/end']};
      const route=routes[path];
      if(!route) return send({error:'not_found'},404);
      if(request.method!==route[0]) return send({error:'method_not_allowed'},405);
      if(!env.LAB_SESSIONS) return send({error:'session_storage_not_configured'},503);
      // Single fixed lab operator coordinator: never trust user-supplied identifiers.
      const id=env.LAB_SESSIONS.idFromName('single-lab-operator');
      const stub=env.LAB_SESSIONS.get(id);
      const result=await stub.fetch('https://coordinator.internal'+route[1],{method:request.method});
      const body=await result.json();return send(body,result.status);
    }
    return send({error:'not_found'},404);
  }
};
