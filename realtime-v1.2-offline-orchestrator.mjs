/** Deterministic offline voice turn orchestrator. No audio bytes, provider or network. */
import {createOfflineSession,advanceOfflineSession,sessionPublicSnapshot} from "./realtime-v1.2-session-engine.mjs";
import {createEventQueue,dequeueEvent} from "./realtime-v1.2-event-queue.mjs";
import {enqueueAudioMetadata} from "./realtime-v1.2-audio-contract.mjs";
const events={input_audio_started:"speech_start",input_audio_stopped:"speech_end",output_audio_started:"assistant_turn_done",output_audio_stopped:"assistant_turn_done"};
export function createOfflineVoice({reservationId,now=0,capacity=16}={}){
 const s=createOfflineSession({reservationId,now}),q=createEventQueue({capacity});
 if(!s.ok||!q.ok)return {ok:false,error:s.error||q.error};
 return {ok:true,voice:Object.freeze({session:s.session,queue:q.queue,turn:0,inputOpen:false,outputOpen:false})};
}
export function transitionVoice(voice,event,{now,callId,providerAcknowledged}={}){
 if(!voice?.session||!voice.queue)return {ok:false,error:"invalid_voice"};
 const next=advanceOfflineSession(voice.session,event,{now,callId,providerAcknowledged});
 if(!next.ok)return next;
 return {ok:true,voice:Object.freeze({...voice,session:next.session})};
}
export function acceptAudioEvent(voice,raw){
 if(!voice?.session||!voice.queue)return {ok:false,error:"invalid_voice"};
 if(voice.session.state!=="active")return {ok:false,error:"session_not_active"};
 const kind=raw?.kind;
 if(kind==="input_audio_started"&&(voice.inputOpen||voice.outputOpen))return {ok:false,error:"turn_overlap"};
 if(kind==="input_audio_stopped"&&!voice.inputOpen)return {ok:false,error:"input_not_open"};
 if(kind==="output_audio_started"&&(voice.inputOpen||voice.outputOpen))return {ok:false,error:"turn_overlap"};
 if(kind==="output_audio_stopped"&&!voice.outputOpen)return {ok:false,error:"output_not_open"};
 const result=enqueueAudioMetadata(voice.queue,raw);
 if(!result.ok)return result;
 const inputOpen=kind==="input_audio_started"?true:kind==="input_audio_stopped"?false:voice.inputOpen;
 const outputOpen=kind==="output_audio_started"?true:kind==="output_audio_stopped"?false:voice.outputOpen;
 const turn=voice.turn+(kind==="output_audio_stopped"?1:0);
 return {ok:true,voice:Object.freeze({...voice,queue:result.queue,inputOpen,outputOpen,turn})};
}
export function consumeAudioEvent(voice){
 if(!voice?.queue)return {ok:false,error:"invalid_voice"};
 const result=dequeueEvent(voice.queue);
 if(!result.ok)return result;
 return {ok:true,event:result.event,voice:Object.freeze({...voice,queue:result.queue})};
}
export function voiceSnapshot(voice){
 if(!voice?.session)return {ok:false,error:"invalid_voice"};
 return Object.freeze({...sessionPublicSnapshot(voice.session),turn:voice.turn,queued:voice.queue.events.length,inputOpen:voice.inputOpen,outputOpen:voice.outputOpen});
}
