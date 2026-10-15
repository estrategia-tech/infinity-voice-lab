/** Pure offline composition: intent decisions never send messages or perform actions. */
import {createMockConversation,routeMockTurn} from "./realtime-v1.4-conversation-brain.mjs";
import {evaluateMockDecision} from "./realtime-v1.4-safety-gate.mjs";
import {createLinkedMock,changeMockConnection,changeMockSession,linkedSnapshot} from "./realtime-v1.3-session-transport.mjs";
export function createMockDialogue({sessionId,reservationId,now=1}={}){
 const conversation=createMockConversation({sessionId});
 const link=createLinkedMock({reservationId,now});
 if(!conversation.ok||!link.ok)return {ok:false,error:conversation.error||link.error};
 return {ok:true,dialogue:Object.freeze({conversation:conversation.conversation,linked:link.linked})};
}
export function connectMockDialogue(dialogue,event){
 if(!dialogue?.linked)return {ok:false,error:"invalid_dialogue"};
 const r=changeMockConnection(dialogue.linked,event);
 if(!r.ok)return r;
 return {ok:true,dialogue:Object.freeze({...dialogue,linked:r.linked})};
}
export function advanceMockDialogueSession(dialogue,event,options){
 if(!dialogue?.linked)return {ok:false,error:"invalid_dialogue"};
 const r=changeMockSession(dialogue.linked,event,options);
 if(!r.ok)return r;
 return {ok:true,dialogue:Object.freeze({...dialogue,linked:r.linked})};
}
export function handleMockUtterance(dialogue,{text,turn,materialsVerified=false,humanAvailable=false}={}){
 if(!dialogue?.conversation||!dialogue.linked)return {ok:false,error:"invalid_dialogue"};
 const snap=linkedSnapshot(dialogue.linked);
 if(dialogue.linked.transport.state!=="connected"||snap.state!=="active")
  return {ok:false,error:"dialogue_not_active"};
 const routed=routeMockTurn(dialogue.conversation,{text,turn});
 if(!routed.ok)return routed;
 const gated=evaluateMockDecision(routed.decision,{materialsVerified,humanAvailable});
 if(!gated.ok)return gated;
 return {ok:true,dialogue:Object.freeze({...dialogue,conversation:routed.conversation}),
  result:Object.freeze({...routed.decision,disposition:gated.disposition,execute:false})};
}
