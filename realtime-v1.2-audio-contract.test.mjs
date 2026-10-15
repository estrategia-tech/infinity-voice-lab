import test from "node:test";
import assert from "node:assert/strict";
import {validateAudioEvent,enqueueAudioMetadata} from "./realtime-v1.2-audio-contract.mjs";
import {createEventQueue,dequeueEvent} from "./realtime-v1.2-event-queue.mjs";
const event=(sequence,kind="input_audio_started")=>({sequence,kind,durationMs:120,sampleRateHz:24000,channels:1});
test("audio contract accepts only bounded metadata and no raw audio",()=>{
 const x=validateAudioEvent(event(1));assert.equal(x.ok,true);
 assert.equal(Object.isFrozen(x.event),true);
 assert.equal(validateAudioEvent({...event(1),pcm:"secret"}).error,"unexpected_audio_payload");
 assert.equal(validateAudioEvent({...event(1),durationMs:120001}).ok,false);
 assert.equal(validateAudioEvent({...event(1),channels:2}).ok,false);
 assert.equal(validateAudioEvent({...event(1),sampleRateHz:999}).ok,false);
});
test("audio metadata uses bounded sequence queue and rejects replay, gaps, overflow",()=>{
 let q=createEventQueue({capacity:2}).queue;
 q=enqueueAudioMetadata(q,event(1)).queue;
 assert.equal(enqueueAudioMetadata(q,event(1)).error,"replay_or_out_of_order");
 assert.equal(enqueueAudioMetadata(q,event(3)).error,"sequence_gap");
 q=enqueueAudioMetadata(q,event(2,"input_audio_stopped")).queue;
 assert.equal(enqueueAudioMetadata(q,event(3)).error,"queue_full");
 const out=dequeueEvent(q);assert.equal(out.event.sequence,1);
 assert.equal(enqueueAudioMetadata(out.queue,event(3)).ok,true);
});
test("no fabricated audio event can bypass queue validation",()=>{
 const q=createEventQueue().queue;
 assert.equal(enqueueAudioMetadata(q,{...event(1),apiKey:"synthetic"}).error,"unexpected_audio_payload");
 assert.equal(enqueueAudioMetadata(q,event(0)).ok,false);
 assert.equal(enqueueAudioMetadata(q,event(1,"invalid_kind")).ok,false);
});
