/**
 * Infinity Voice v2.0 — offline conversational orchestration boundary.
 * Accepts untrusted mock-model proposals and produces decisions only.
 */
import { validateOfflineModelProposal } from "./realtime-v2.0-model-contract.mjs";
import { evaluateOfflineToolCall } from "./realtime-v2.0-tool-policy.mjs";
import { evaluateOfflineCommercialClaims, evaluateOfflineHandoff } from "./realtime-v2.0-commercial-policy.mjs";

const SESSION_RE = /^mock_[a-zA-Z0-9_-]{8,64}$/;

export function createOfflineConversationOrchestrator({ sessionId, toolPolicy, materialCatalog } = {}) {
  if (!SESSION_RE.test(sessionId ?? "") || toolPolicy?.kind !== "offline-tool-policy" ||
      materialCatalog?.kind !== "offline-material-catalog") {
    return { ok: false, error: "invalid_orchestrator_config" };
  }
  return {
    ok: true,
    orchestrator: Object.freeze({
      kind: "offline-conversation-orchestrator",
      sessionId,
      nextTurn: 1,
      handoffLocked: false,
      lastIntent: "unknown",
      toolPolicy,
      materialCatalog,
      processedTurns: 0,
    }),
  };
}

export function handleOfflineModelProposal(orchestrator, rawProposal, { humanAvailable = false } = {}) {
  if (orchestrator?.kind !== "offline-conversation-orchestrator") {
    return { ok: false, error: "invalid_orchestrator" };
  }
  if (orchestrator.handoffLocked) return { ok: false, error: "handoff_locked" };
  const validated = validateOfflineModelProposal(rawProposal, { expectedTurn: orchestrator.nextTurn });
  if (!validated.ok) return validated;
  const proposal = validated.proposal;

  const toolResults = [];
  for (const call of proposal.toolCalls) {
    const result = evaluateOfflineToolCall(orchestrator.toolPolicy, call, { catalog: orchestrator.materialCatalog });
    if (!result.ok) return result;
    toolResults.push(Object.freeze({ name: call.name, ...result }));
  }

  const claims = evaluateOfflineCommercialClaims(proposal.claims);
  if (!claims.ok) return claims;
  const toolRequestedHandoff = proposal.toolCalls.some((call) => call.name === "request_human_review");
  const handoff = evaluateOfflineHandoff({
    requested: proposal.handoffRequested || toolRequestedHandoff || proposal.intent === "human_handoff",
    humanAvailable,
  });
  if (!handoff.ok) return handoff;

  const verificationHold = claims.heldClaims.length > 0 || toolResults.some((result) => result.disposition === "hold_for_verification");
  const disposition = handoff.lockConversation ? handoff.disposition : verificationHold ? "hold_for_verification" : "draft_ready_offline";
  const next = Object.freeze({
    ...orchestrator,
    nextTurn: orchestrator.nextTurn + 1,
    processedTurns: orchestrator.processedTurns + 1,
    lastIntent: proposal.intent,
    handoffLocked: handoff.lockConversation,
  });
  return {
    ok: true,
    orchestrator: next,
    plan: Object.freeze({
      turn: proposal.turn,
      intent: proposal.intent,
      disposition,
      draftReply: proposal.reply,
      publishable: false,
      execute: false,
      modelSource: proposal.sourceVersion,
      toolResults: Object.freeze(toolResults),
      safeClaims: claims.safeClaims,
      heldClaims: claims.heldClaims,
      handoff: Object.freeze(handoff),
    }),
  };
}
