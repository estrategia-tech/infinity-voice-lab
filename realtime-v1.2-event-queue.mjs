/** Pure offline event buffer; no media, credentials, or network I/O. */
const kinds=new Set(["speech_start","speech_end","transcript_final","assistant_turn_done"]);
export function createEventQueue({capacity=16}={}){
 if(!Number.isSafeInteger(capacity)||capacity<1||capacity>64)return {ok:false,error:"invalid_capacity"};
 return {ok:true,queue:Object.freeze({capacity,lastSequence:0,events:Object.freeze([])})};
}
export function enqueueEvent(queue,event){
 if(!queue||!Number.isSafeInteger(queue.capacity)||!Array.isArray(queue.events))
  return {ok:false,error:"invalid_queue"};
 if(!event||!Number.isSafeInteger(event.sequence)||event.sequence<=0||
  typeof event.kind!=="string"||!kinds.has(event.kind))
  return {ok:false,error:"invalid_event"};
 if(event.sequence<=queue.lastSequence)return {ok:false,error:"replay_or_out_of_order"};
 if(event.sequence!==queue.lastSequence+1)return {ok:false,error:"sequence_gap"};
 if(queue.events.length>=queue.capacity)return {ok:false,error:"queue_full"};
 const safe=Object.freeze({sequence:event.sequence,kind:event.kind});
 return {ok:true,queue:Object.freeze({...queue,lastSequence:event.sequence,events:Object.freeze([...queue.events,safe])})};
}
export function dequeueEvent(queue){
 if(!queue||!Array.isArray(queue.events)||queue.events.length===0)return {ok:false,error:"queue_empty"};
 return {ok:true,event:queue.events[0],queue:Object.freeze({...queue,events:Object.freeze(queue.events.slice(1))})};
}
