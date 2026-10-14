import test from "node:test";
import assert from "node:assert/strict";
import {reserveForLab} from "./realtime-v1.1-admission-candidate.mjs";
test("disabled by default, no storage access",async()=>{
 let called=0;
 const result=await reserveForLab({ledgerStub:{fetch:async()=>{called++;throw Error("should not call")}}});
 assert.equal(result.status,403);assert.equal(called,0);
});
test("missing or failing ledger fails closed",async()=>{
 assert.equal((await reserveForLab({enabled:true})).status,503);
 assert.equal((await reserveForLab({enabled:true,ledgerStub:{fetch:async()=>{throw Error("down")}}})).status,503);
});
test("ledger quota rejection propagates without credentials",async()=>{
 const result=await reserveForLab({enabled:true,ledgerStub:{fetch:async()=>Response.json({error:"daily_session_limit"},{status:429})}});
 assert.equal(result.ok,false);assert.equal(result.status,429);
});
test("valid internal reservation returns only admission metadata",async()=>{
 const result=await reserveForLab({enabled:true,ledgerStub:{fetch:async()=>Response.json({reservationId:"internal",expiresAt:Date.now()+120000,maxSeconds:120})}});
 assert.equal(result.ok,true);assert.equal(result.reservation.maxSeconds,120);
 assert.equal("client_secret" in result,false);
});
test("invalid ledger payload is rejected",async()=>{
 const result=await reserveForLab({enabled:true,ledgerStub:{fetch:async()=>Response.json({reservationId:"a"})}});
 assert.equal(result.status,503);
});
