/** Stage 4 offline intent routing: no model, API, transcript persistence, or external action. */
const INTENTS=Object.freeze(["greeting","property_information","schedule_visit","human_handoff","unknown"]);
const ALLOWED=Object.freeze({
 greeting:["greeting","property_information","schedule_visit","human_handoff","unknown"],
 property_information:["property_information","schedule_visit","human_handoff","unknown"],
 schedule_visit:["schedule_visit","human_handoff","unknown"],
 human_handoff:["human_handoff"],
 unknown:["greeting","property_information","schedule_visit","human_handoff","unknown"]
});
export function classifyMockIntent(input){
 if(typeof input!=="string"||input.length>280)return {ok:false,error:"invalid_input"};
 const value=input.trim().toLowerCase();
 if(!value)return {ok:false,error:"invalid_input"};
 const matches=[
  [/\b(humano|asesor|persona|agente)\b/u,"human_handoff"],
  [/\b(visita|cita|agendar|recorrido)\b/u,"schedule_visit"],
  [/\b(precio|propiedad|departamento|terreno|información|informacion)\b/u,"property_information"],
  [/\b(hola|buenos días|buenas tardes|buenas noches)\b/u,"greeting"]
 ].filter(([pattern])=>pattern.test(value));
 return {ok:true,intent:matches.length?matches[0][1]:"unknown",source:"deterministic_mock"};
}
export function createMockConversation({sessionId}={}){
 if(typeof sessionId!=="string"||!/^mock_[a-zA-Z0-9_-]{8,64}$/.test(sessionId))
  return {ok:false,error:"invalid_session"};
 return {ok:true,conversation:Object.freeze({sessionId,turn:0,lastIntent:"unknown",handoff:false})};
}
export function routeMockTurn(conversation,{text,turn}={}){
 if(!conversation||conversation.handoff)return {ok:false,error:"handoff_locked"};
 if(!Number.isSafeInteger(turn)||turn!==conversation.turn+1)return {ok:false,error:"turn_order"};
 const result=classifyMockIntent(text);
 if(!result.ok)return result;
 const intent=result.intent;
 if(!INTENTS.includes(intent)||!ALLOWED[conversation.lastIntent].includes(intent))
  return {ok:false,error:"intent_transition_denied"};
 const handoff=intent==="human_handoff";
 const next=Object.freeze({...conversation,turn,lastIntent:intent,handoff});
 const action=handoff?"request_human_review":intent==="schedule_visit"?"collect_visit_preferences":intent==="property_information"?"offer_verified_materials":"acknowledge";
 return {ok:true,conversation:next,decision:Object.freeze({intent,action,requiresHuman:handoff,source:"offline_rules"})};
}
