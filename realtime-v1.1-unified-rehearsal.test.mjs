import test from "node:test";
import assert from "node:assert/strict";
import {rehearseUnifiedSession} from "./realtime-v1.1-unified-rehearsal.mjs";
const secret="x".repeat(40),origin="https://lab.example.test";
const sdp="v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
const req=(body=sdp,token=secret)=>new Request(origin+"/api/realtime/session",{method:"POST",headers:{origin,authorization:"Bearer "+token},body});
const env={LAB_ALLOWED_ORIGIN:origin,LAB_ACCESS_TOKEN:secret,MOCK_LAB_ENABLED:true};
const ledger=()=>{let count=0,active=false,releases=0;return {get count(){return count},get releases(){return releases},async fetch(request){const path=new URL(request.url).pathname;if(path.endsWith("/release")){releases++;active=false;return Response.json({released:true})}if(active)return Response.json({error:"concurrency_limit"},{status:429});active=true;count++;return Response.json({reservationId:"mock-"+count,expiresAt:Date.now()+120000,maxSeconds:120})}}};
test("mock disabled even with valid auth",async()=>{
 const l=ledger();const x=await rehearseUnifiedSession({request:req(),env:{...env,MOCK_LAB_ENABLED:false},ledgerStub:l,mockProvider:async()=>sdp});
 assert.equal(x.status,403);assert.equal(l.count,0);
});
test("unauthorized and malformed SDP cannot reserve",async()=>{
 const l=ledger();assert.equal((await rehearseUnifiedSession({request:req(sdp,"bad"),env,ledgerStub:l,mockProvider:async()=>sdp})).status,401);
 assert.equal((await rehearseUnifiedSession({request:req("invalid"),env,ledgerStub:l,mockProvider:async()=>sdp})).status,400);assert.equal(l.count,0);
});
test("valid request returns synthetic answer; second blocked",async()=>{
 const l=ledger();const first=await rehearseUnifiedSession({request:req(),env,ledgerStub:l,mockProvider:async()=>sdp});
 assert.equal(first.ok,true);assert.equal(first.mock,true);assert.equal(l.count,1);
 const second=await rehearseUnifiedSession({request:req(),env,ledgerStub:l,mockProvider:async()=>sdp});
 assert.equal(second.ok,false);assert.equal(second.status,429);
});
test("mock provider failure releases concurrency",async()=>{
 const l=ledger();const x=await rehearseUnifiedSession({request:req(),env,ledgerStub:l,mockProvider:async()=>{throw Error("offline failure")}});
 assert.equal(x.status,502);assert.equal(l.releases,1);
});

test("release refusal must never be reported as recovered",async()=>{
 const l=ledger();
 const original=l.fetch.bind(l);
 l.fetch=async request=>new URL(request.url).pathname.endsWith("/release")?
  Response.json({error:"storage_down"},{status:503}):original(request);
 const x=await rehearseUnifiedSession({request:req(),env,ledgerStub:l,mockProvider:async()=>{throw Error("mock failure")}});
 assert.equal(x.status,503);assert.equal(x.error,"mock_failed_release_unverified");
});
test("oversized body without content-length cannot reserve",async()=>{
 const l=ledger();const x=await rehearseUnifiedSession({request:req(sdp+"x".repeat(33000)),env,ledgerStub:l,mockProvider:async()=>sdp});
 assert.equal(x.status,413);assert.equal(l.count,0);
});
