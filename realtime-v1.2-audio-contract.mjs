/** Offline metadata-only audio event contract. No microphone, bytes, network or provider. */
const kinds=new Set(["input_audio_started","input_audio_stopped","output_audio_started","output_audio_stopped"]);
const allowed=new Set(["sequence","kind","durationMs","sampleRateHz","channels"]);
export function validateAudioEvent(event){
 if(!event||typeof event!=="object"||Array.isArray(event))
  return {ok:false,error:"invalid_audio_event"};
 if(Object.keys(event).some(k=>!allowed.has(k)))
  return {ok:false,error:"unexpected_audio_payload"};
 if(!Number.isSafeInteger(event.sequence)||event.sequence<1||!kinds.has(event.kind)||
  !Number.isSafeInteger(event.durationMs)||event.durationMs<0||event.durationMs>120000||
  ![16000,24000,48000].includes(event.sampleRateHz)||event.channels!==1)
  return {ok:false,error:"invalid_audio_metadata"};
 return {ok:true,event:Object.freeze({sequence:event.sequence,kind:event.kind,durationMs:event.durationMs,sampleRateHz:event.sampleRateHz,channels:1})};
}
export function enqueueAudioMetadata(queue,rawEvent){
 const checked=validateAudioEvent(rawEvent);
 if(!checked.ok)return checked;
 if(!queue||!Array.isArray(queue.events)||!Number.isSafeInteger(queue.capacity)||
  !Number.isSafeInteger(queue.lastSequence))
  return {ok:false,error:"invalid_queue"};
 if(checked.event.sequence<=queue.lastSequence)return {ok:false,error:"replay_or_out_of_order"};
 if(checked.event.sequence!==queue.lastSequence+1)return {ok:false,error:"sequence_gap"};
 if(queue.events.length>=queue.capacity)return {ok:false,error:"queue_full"};
 return {ok:true,queue:Object.freeze({...queue,lastSequence:checked.event.sequence,
  events:Object.freeze([...queue.events,checked.event])})};
}
