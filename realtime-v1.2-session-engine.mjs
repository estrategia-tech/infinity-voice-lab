/**
 * Stage 2: offline voice-session state machine. No provider, network, keys or audio.
 * Immutable transitions; only explicit provider acknowledgement can mark terminated.
 */
export const SESSION_STATES=Object.freeze(["idle","admitted","negotiating","active","terminating","termination_unconfirmed","terminated"]);
const transitions=Object.freeze({
 idle:{admit:"admitted"},
 admitted:{offer_accepted:"negotiating",cancel:"terminated"},
 negotiating:{provider_connected:"active",request_termination:"terminating"},
 active:{request_termination:"terminating"},
 terminating:{provider_ack:"terminated",provider_unknown:"termination_unconfirmed"},
 termination_unconfirmed:{review_required:"termination_unconfirmed"}
});
const idOk=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{6,128}$/.test(x);
export function createOfflineSession({reservationId,now=0}={}){
 if(!idOk(reservationId)||!Number.isSafeInteger(now)||now<0)
  return {ok:false,error:"invalid_session"};
 return {ok:true,session:Object.freeze({reservationId,state:"idle",revision:0,updatedAt:now,callId:null})};
}
export function advanceOfflineSession(session,event,{now,callId,providerAcknowledged=false}={}){
 if(!session||!idOk(session.reservationId)||!SESSION_STATES.includes(session.state)||
  !Number.isSafeInteger(session.revision)||session.revision<0||!Number.isSafeInteger(now)||now<session.updatedAt)
  return {ok:false,error:"invalid_transition_input"};
 if(typeof event!=="string"||!Object.hasOwn(transitions[session.state],event))
  return {ok:false,error:"transition_denied",state:session.state};
 if(event==="provider_connected"&&(!idOk(callId)||!callId.startsWith("rtc_")))
  return {ok:false,error:"invalid_call_id"};
 if(event==="provider_ack"&&providerAcknowledged!==true)
  return {ok:false,error:"provider_ack_required"};
 const next=transitions[session.state][event];
 return {ok:true,session:Object.freeze({...session,state:next,revision:session.revision+1,
  updatedAt:now,callId:event==="provider_connected"?callId:session.callId})};
}
export function sessionPublicSnapshot(session){
 if(!session||!SESSION_STATES.includes(session.state))return {ok:false,error:"invalid_session"};
 return Object.freeze({state:session.state,revision:session.revision,needsReview:session.state==="termination_unconfirmed"});
}
