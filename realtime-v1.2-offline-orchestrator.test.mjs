import test from "node:test";
import assert from "node:assert/strict";
import {createOfflineVoice,transitionVoice,acceptAudioEvent,consumeAudioEvent,voiceSnapshot} from "./realtime-v1.2-offline-orchestrator.mjs";
const audio=(sequence,kind)=>({sequence,kind,durationMs:100,sampleRateHz:24000,channels:1});
function active(capacity=4){
 let voice=createOfflineVoice({reservationId:"offline_reservation_001",now:1,capacity}).voice;
 for(const [event,options] of [["admit",{}],["offer_accepted",{}],["provider_connected",{callId:"rtc_mock123456"}]]){
  const x=transitionVoice(voice,event,{now:voice.session.updatedAt+1,...options});assert.equal(x.ok,true);voice=x.voice;
 }
 return voice;
}
test("full simulated input/output turn and safe termination",()=>{
 let voice=active();
 for(const [i,kind] of ["input_audio_started","input_audio_stopped","output_audio_started","output_audio_stopped"].entries()){
  const result=acceptAudioEvent(voice,audio(i+1,kind));assert.equal(result.ok,true);voice=result.voice;
 }
 assert.equal(voiceSnapshot(voice).turn,1);
 assert.equal(voiceSnapshot(voice).queued,4);
 assert.equal(voiceSnapshot(voice).inputOpen,false);
 assert.equal(voiceSnapshot(voice).outputOpen,false);
 assert.equal(acceptAudioEvent(voice,audio(4,"input_audio_started")).error,"replay_or_out_of_order");
 for(let i=1;i<=4;i++){const out=consumeAudioEvent(voice);assert.equal(out.event.sequence,i);voice=out.voice;}
 assert.equal(voiceSnapshot(voice).queued,0);
 voice=transitionVoice(voice,"request_termination",{now:10}).voice;
 assert.equal(acceptAudioEvent(voice,audio(5,"input_audio_started")).error,"session_not_active");
 assert.equal(transitionVoice(voice,"provider_ack",{now:11}).error,"provider_ack_required");
 assert.equal(transitionVoice(voice,"provider_ack",{now:11,providerAcknowledged:true}).voice.session.state,"terminated");
});
test("invalid turn order and backpressure preserve previous state",()=>{
 let voice=active(1);
 assert.equal(acceptAudioEvent(voice,audio(1,"input_audio_stopped")).error,"input_not_open");
 assert.equal(acceptAudioEvent(voice,audio(1,"output_audio_stopped")).error,"output_not_open");
 const opened=acceptAudioEvent(voice,audio(1,"input_audio_started"));assert.equal(opened.ok,true);voice=opened.voice;
 assert.equal(acceptAudioEvent(voice,audio(2,"output_audio_started")).error,"turn_overlap");
 assert.equal(acceptAudioEvent(voice,audio(2,"input_audio_stopped")).error,"queue_full");
 assert.equal(voiceSnapshot(voice).inputOpen,true);
 assert.equal(acceptAudioEvent(voice,{...audio(2,"input_audio_stopped"),pcm:"raw"}).error,"unexpected_audio_payload");
 const out=consumeAudioEvent(voice);voice=out.voice;
 assert.equal(acceptAudioEvent(voice,audio(2,"input_audio_stopped")).ok,true);
});
test("uncertain termination cannot be converted to terminated by simulation",()=>{
 let voice=active();
 voice=transitionVoice(voice,"request_termination",{now:10}).voice;
 voice=transitionVoice(voice,"provider_unknown",{now:11}).voice;
 assert.equal(voiceSnapshot(voice).needsReview,true);
 assert.equal(transitionVoice(voice,"provider_ack",{now:12,providerAcknowledged:true}).error,"transition_denied");
});
