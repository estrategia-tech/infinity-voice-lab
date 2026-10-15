import test from "node:test";
import assert from "node:assert/strict";
import {createLinkedMock,changeMockConnection,changeMockSession,deliverMockAudio,linkedSnapshot} from "./realtime-v1.3-session-transport.mjs";
const audio=(sequence,kind)=>({sequence,kind,durationMs:120,sampleRateHz:24000,channels:1});
function ready(){
 let linked=createLinkedMock({reservationId:"linked_mock_reservation_1",now:1,maxRetries:1}).linked;
 for(const event of ["connect","connected"])linked=changeMockConnection(linked,event).linked;
 for(const event of ["admit","offer_accepted","provider_connected"]){
  const r=changeMockSession(linked,event,{now:linked.voice.session.updatedAt+1,callId:"rtc_mock_123456"});
  assert.equal(r.ok,true,event);linked=r.linked;
 }
 return linked;
}
test("integration: simulated audio, connection drop and bounded recovery",()=>{
 let linked=ready();
 const start=deliverMockAudio(linked,audio(1,"input_audio_started"));assert.equal(start.ok,true);linked=start.linked;
 linked=changeMockConnection(linked,"drop").linked;
 assert.equal(deliverMockAudio(linked,audio(2,"input_audio_stopped")).error,"transport_not_connected");
 assert.equal(linkedSnapshot(linked).state,"active");
 assert.equal(linkedSnapshot(linked).transportState,"interrupted");
 linked=changeMockConnection(linked,"retry").linked;
 linked=changeMockConnection(linked,"connected").linked;
 linked=deliverMockAudio(linked,audio(2,"input_audio_stopped")).linked;
 linked=deliverMockAudio(linked,audio(3,"output_audio_started")).linked;
 linked=deliverMockAudio(linked,audio(4,"output_audio_stopped")).linked;
 assert.equal(linkedSnapshot(linked).turn,1);
 assert.equal(linkedSnapshot(linked).queued,4);
 linked=changeMockConnection(linked,"drop").linked;
 assert.equal(changeMockConnection(linked,"retry").error,"retry_limit");
 assert.equal(linkedSnapshot(linked).state,"active");
});
test("transport disconnect never claims provider acknowledgement or releases session",()=>{
 let linked=ready();
 linked=changeMockConnection(linked,"drop").linked;
 assert.equal(linkedSnapshot(linked).state,"active");
 linked=changeMockSession(linked,"request_termination",{now:10}).linked;
 linked=changeMockSession(linked,"provider_unknown",{now:11}).linked;
 assert.equal(linkedSnapshot(linked).needsReview,true);
 assert.equal(changeMockSession(linked,"provider_ack",{now:12,providerAcknowledged:true}).error,"transition_denied");
 assert.equal(deliverMockAudio(linked,audio(1,"input_audio_started")).error,"transport_not_connected");
});
test("closed connection cannot be revived and connection is required before session bind",()=>{
 let linked=createLinkedMock({reservationId:"linked_mock_reservation_2",now:1}).linked;
 linked=changeMockSession(linked,"admit",{now:2}).linked;
 linked=changeMockSession(linked,"offer_accepted",{now:3}).linked;
 assert.equal(changeMockSession(linked,"provider_connected",{now:4,callId:"rtc_mock_123456"}).error,"transport_not_connected");
 linked=changeMockConnection(linked,"close").linked;
 assert.equal(changeMockConnection(linked,"connect").error,"transition_denied");
});
