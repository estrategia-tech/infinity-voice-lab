/** Offline composition: transport loss cannot terminate/release a session. */
import {createOfflineVoice,transitionVoice,acceptAudioEvent,voiceSnapshot} from "./realtime-v1.2-offline-orchestrator.mjs";
import {createMockTransport,transitionTransport,sendMockFrame} from "./realtime-v1.3-transport-candidate.mjs";
export function createLinkedMock({reservationId,now=0,maxRetries=2}={}){
 const voice=createOfflineVoice({reservationId,now}),transport=createMockTransport({maxRetries});
 if(!voice.ok||!transport.ok)return {ok:false,error:voice.error||transport.error};
 return {ok:true,linked:Object.freeze({voice:voice.voice,transport:transport.transport})};
}
export function changeMockConnection(linked,event){
 if(!linked?.voice||!linked.transport)return {ok:false,error:"invalid_linked_state"};
 if(linked.voice.session.state==="terminated"&&event!=="close")return {ok:false,error:"session_terminated"};
 const r=transitionTransport(linked.transport,event);
 if(!r.ok)return r;
 return {ok:true,linked:Object.freeze({...linked,transport:r.transport})};
}
export function changeMockSession(linked,event,options){
 if(!linked?.voice||!linked.transport)return {ok:false,error:"invalid_linked_state"};
 if(event==="provider_connected"&&linked.transport.state!=="connected")
  return {ok:false,error:"transport_not_connected"};
 const r=transitionVoice(linked.voice,event,options);
 if(!r.ok)return r;
 return {ok:true,linked:Object.freeze({...linked,voice:r.voice})};
}
export function deliverMockAudio(linked,raw){
 if(!linked?.voice||!linked.transport)return {ok:false,error:"invalid_linked_state"};
 if(linked.transport.state!=="connected")return {ok:false,error:"transport_not_connected"};
 const r=acceptAudioEvent(linked.voice,raw);
 if(!r.ok)return r;
 const sent=sendMockFrame(linked.transport,{sequence:linked.transport.sequence+1,type:"audio_metadata"});
 if(!sent.ok)return sent;
 return {ok:true,linked:Object.freeze({voice:r.voice,transport:sent.transport}),receipt:sent.receipt};
}
export function linkedSnapshot(linked){
 if(!linked?.voice||!linked.transport)return {ok:false,error:"invalid_linked_state"};
 return Object.freeze({transportState:linked.transport.state,retries:linked.transport.retries,...voiceSnapshot(linked.voice)});
}
