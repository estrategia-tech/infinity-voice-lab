/** Decisions only. Never contacts a human or publishes unverified offers. */
const ACTIONS=new Set(["acknowledge","offer_verified_materials","collect_visit_preferences","request_human_review"]);
export function evaluateMockDecision(decision,{materialsVerified=false,humanAvailable=false}={}){
 if(!decision||!ACTIONS.has(decision.action))return {ok:false,error:"unknown_action"};
 if(decision.action==="offer_verified_materials"&&!materialsVerified)
  return {ok:true,disposition:"hold_for_verification",execute:false};
 if(decision.action==="request_human_review")
  return {ok:true,disposition:humanAvailable?"handoff_eligible":"handoff_pending",execute:false};
 return {ok:true,disposition:"simulation_only",execute:false};
}
