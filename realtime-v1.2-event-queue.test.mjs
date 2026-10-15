import test from "node:test";
import assert from "node:assert/strict";
import {createEventQueue,enqueueEvent,dequeueEvent} from "./realtime-v1.2-event-queue.mjs";
test("bounded queue rejects overflow without dropping events",()=>{
 let q=createEventQueue({capacity:2}).queue;
 q=enqueueEvent(q,{sequence:1,kind:"speech_start",privateData:"never stored"}).queue;
 q=enqueueEvent(q,{sequence:2,kind:"speech_end"}).queue;
 assert.equal(enqueueEvent(q,{sequence:3,kind:"transcript_final"}).error,"queue_full");
 assert.equal(q.events.length,2);
 assert.equal(q.events[0].privateData,undefined);
 const out=dequeueEvent(q);assert.equal(out.event.sequence,1);
 assert.equal(enqueueEvent(out.queue,{sequence:3,kind:"transcript_final"}).ok,true);
});
test("replays, gaps, invalid kinds and invalid capacity fail closed",()=>{
 const q=createEventQueue().queue;
 assert.equal(createEventQueue({capacity:65}).ok,false);
 assert.equal(enqueueEvent(q,{sequence:2,kind:"speech_start"}).error,"sequence_gap");
 assert.equal(enqueueEvent(q,{sequence:1,kind:"arbitrary"}).error,"invalid_event");
 const one=enqueueEvent(q,{sequence:1,kind:"speech_start"}).queue;
 assert.equal(enqueueEvent(one,{sequence:1,kind:"speech_end"}).error,"replay_or_out_of_order");
 assert.equal(dequeueEvent(q).error,"queue_empty");
 assert.equal(Object.isFrozen(one.events),true);
});
