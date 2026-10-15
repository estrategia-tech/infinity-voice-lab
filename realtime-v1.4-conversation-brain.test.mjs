import test from "node:test";
import assert from "node:assert/strict";
import {createMockConversation,routeMockTurn,classifyMockIntent} from "./realtime-v1.4-conversation-brain.mjs";
test("intent decisions are deterministic and do not execute actions",()=>{
 let c=createMockConversation({sessionId:"mock_session_001"}).conversation;
 for(const [text,intent,action] of [
  ["hola","greeting","acknowledge"],
  ["quiero información de un departamento","property_information","offer_verified_materials"],
  ["quiero agendar visita","schedule_visit","collect_visit_preferences"],
  ["quiero un asesor humano","human_handoff","request_human_review"]]){
  const r=routeMockTurn(c,{text,turn:c.turn+1});
  assert.equal(r.ok,true);assert.equal(r.decision.intent,intent);assert.equal(r.decision.action,action);c=r.conversation;
 }
 assert.equal(routeMockTurn(c,{text:"hola",turn:5}).error,"handoff_locked");
});
test("deny replay, invalid inputs and prohibited intent reversal",()=>{
 let c=createMockConversation({sessionId:"mock_session_002"}).conversation;
 assert.equal(routeMockTurn(c,{text:"hola",turn:2}).error,"turn_order");
 assert.equal(classifyMockIntent(" ".repeat(3)).ok,false);
 assert.equal(classifyMockIntent("x".repeat(281)).ok,false);
 c=routeMockTurn(c,{text:"quiero agendar visita",turn:1}).conversation;
 assert.equal(routeMockTurn(c,{text:"hola",turn:2}).error,"intent_transition_denied");
 assert.equal(createMockConversation({sessionId:"real_session"}).ok,false);
});
