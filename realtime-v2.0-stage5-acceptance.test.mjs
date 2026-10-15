import test from "node:test";
import assert from "node:assert/strict";
import {
  createOfflineRevocationRegistry,
  generateEphemeralCapabilityKeyPair,
  issueOfflineCapability,
  verifyOfflineCapability,
} from "./realtime-v2.0-capability.mjs";
import {
  applyOfflineProviderEvent,
  createOfflineProviderAdapter,
} from "./realtime-v2.0-provider-contract.mjs";
import {
  acceptOfflineStreamFrame,
  createOfflineAudioStream,
} from "./realtime-v2.0-audio-stream.mjs";
import { createSyntheticOfflineAudioFrame } from "./realtime-v2.0-audio-frame.mjs";
import {
  createOfflineMaterialCatalog,
  createOfflineToolPolicy,
} from "./realtime-v2.0-tool-policy.mjs";
import {
  createOfflineConversationOrchestrator,
  handleOfflineModelProposal,
} from "./realtime-v2.0-conversation-orchestrator.mjs";
import {
  authorizeOfflineSessionStep,
  createOfflineSessionGuard,
} from "./realtime-v2.0-session-guard.mjs";
import {
  claimOfflineRuntimeSlot,
  createOfflineRuntimeGuard,
  releaseOfflineRuntimeSlot,
  setOfflineEmergencyStop,
} from "./realtime-v2.0-runtime-guard.mjs";
import {
  appendOfflinePrivacyAudit,
  authorizeOfflinePrivacySession,
  createOfflinePrivacyGuard,
} from "./realtime-v2.0-privacy-guard.mjs";
import {
  beginOfflineOperation,
  canReleaseOfflineCapacity,
  createOfflineResilienceState,
  recordOfflineOperationSuccess,
} from "./realtime-v2.0-resilience.mjs";
import { evaluateOfflinePilotReadiness } from "./realtime-v2.0-pilot-gate.mjs";

const SESSION = "mock_stage5_endtoend01";

function proposal({ turn = 1, toolCalls = [], claims = [], intent = "property_information", handoffRequested = false } = {}) {
  return {
    turn,
    reply: "Borrador offline sujeto a controles y verificación.",
    intent,
    toolCalls,
    claims,
    handoffRequested,
    sourceVersion: "mockmodel-v1",
  };
}

test("end-to-end offline candidate crosses stages 1-4 without live side effects", () => {
  const scopes = new Set(["voice:session:open"]);
  const keys = generateEphemeralCapabilityKeyPair();
  const registry = createOfflineRevocationRegistry();
  const issued = issueOfflineCapability({
    privateKey: keys.privateKey,
    sessionId: SESSION,
    contextId: "mockctx_stage5context01",
    origin: "lab://infinity.voice",
    scope: "voice:session:open",
    authorizedScopes: scopes,
    now: 1_000,
    ttlMs: 30_000,
    jti: "mockcap_stage5credential01",
  });
  assert.equal(issued.ok, true);
  const verified = verifyOfflineCapability(issued.token, {
    publicKey: keys.publicKey,
    now: 1_100,
    expectedSessionId: SESSION,
    expectedContextId: "mockctx_stage5context01",
    expectedOrigin: "lab://infinity.voice",
    requiredScope: "voice:session:open",
    allowedScopes: scopes,
    replayGuard: new Set(),
    revocationRegistry: registry,
  });
  assert.equal(verified.ok, true);

  let provider = createOfflineProviderAdapter({ sessionId: SESSION }).adapter;
  for (const [event, receipt] of [
    ["session_open_requested"],
    ["session_open_confirmed"],
  ]) {
    const result = applyOfflineProviderEvent(provider, {
      event,
      sessionId: SESSION,
      sequence: provider.sequence + 1,
      ...(receipt ? { providerReceipt: receipt } : {}),
    });
    assert.equal(result.ok, true);
    provider = result.adapter;
  }
  assert.equal(provider.status, "open");

  let runtime = createOfflineRuntimeGuard({ maxConcurrent: 2, maxStartsPerWindow: 4, windowMs: 60_000 }).runtime;
  runtime = claimOfflineRuntimeSlot(runtime, {
    sessionId: SESSION,
    actorId: "mockactor_stage5operator01",
    now: 1_200,
  }).runtime;

  let privacy = createOfflinePrivacyGuard({ requireConsent: true, retentionMs: 60_000, maxAuditEvents: 10 }).guard;
  privacy = authorizeOfflinePrivacySession(privacy, {
    sessionId: SESSION,
    consentGranted: true,
    now: 1_200,
  }).guard;

  let budget = createOfflineSessionGuard({
    sessionId: SESSION,
    startedAt: 1_200,
    maxDurationMs: 60_000,
    maxBudgetUnits: 100,
  }).guard;
  const budgetStep = authorizeOfflineSessionStep(budget, { now: 1_300, costUnits: 10 });
  assert.equal(budgetStep.ok, true);
  budget = budgetStep.guard;

  let stream = createOfflineAudioStream({ direction: "input", streamEpoch: 1 }).stream;
  const synthetic = createSyntheticOfflineAudioFrame({
    streamEpoch: 1,
    sequence: 1,
    timestampMs: 1_300,
    direction: "input",
    fillByte: 7,
  });
  assert.equal(synthetic.ok, true);
  const accepted = acceptOfflineStreamFrame(stream, synthetic.frame);
  assert.equal(accepted.ok, true);
  stream = accepted.stream;
  assert.equal(stream.lastAcceptedSequence, 1);

  const toolPolicy = createOfflineToolPolicy({
    allowedTools: ["get_verified_material", "collect_visit_preferences", "request_human_review"],
  }).policy;
  const materialCatalog = createOfflineMaterialCatalog([
    { id: "mock_material_stage5verified", version: "v1", verified: true, summary: "Material verificado de laboratorio." },
    { id: "mock_material_stage5pending", version: "v1", verified: false, summary: "Material pendiente de verificación." },
  ]).catalog;
  let conversation = createOfflineConversationOrchestrator({ sessionId: SESSION, toolPolicy, materialCatalog }).orchestrator;

  const safeTurn = handleOfflineModelProposal(conversation, proposal({
    toolCalls: [{ name: "get_verified_material", args: { material_id: "mock_material_stage5verified" } }],
    claims: [{
      kind: "price",
      value: "$3,000,000 MXN de prueba",
      sourceId: "mocksrc_stage5price01",
      sourceVersion: "v1",
      verified: true,
      guaranteed: false,
    }],
  }));
  assert.equal(safeTurn.ok, true);
  assert.equal(safeTurn.plan.publishable, false);
  assert.equal(safeTurn.plan.execute, false);
  assert.equal(safeTurn.plan.disposition, "draft_ready_offline");
  conversation = safeTurn.orchestrator;

  const heldTurn = handleOfflineModelProposal(conversation, proposal({
    turn: 2,
    toolCalls: [{ name: "get_verified_material", args: { material_id: "mock_material_stage5pending" } }],
    claims: [{
      kind: "availability",
      value: "Disponibilidad pendiente",
      sourceId: "mocksrc_stage5avail01",
      sourceVersion: "v1",
      verified: false,
      guaranteed: false,
    }],
  }));
  assert.equal(heldTurn.ok, true);
  assert.equal(heldTurn.plan.disposition, "hold_for_verification");
  assert.equal(heldTurn.plan.publishable, false);
  assert.equal(heldTurn.plan.execute, false);

  const audit = appendOfflinePrivacyAudit(privacy, {
    sessionId: SESSION,
    event: "session_authorized",
    detail: "dato de prueba test@example.com +52 221 577 7772",
    now: 1_400,
  });
  assert.equal(audit.ok, true);
  assert.equal(audit.entry.detail.includes("test@example.com"), false);
  assert.equal(audit.entry.detail.includes("221 577 7772"), false);

  let resilience = createOfflineResilienceState({ maxRetries: 2, baseRetryDelayMs: 500 }).state;
  resilience = beginOfflineOperation(resilience, {
    operationId: "mockop_stage5close0001",
    sessionId: SESSION,
    operationKind: "provider_close",
    now: 2_000,
  }).state;
  const closeEvidence = recordOfflineOperationSuccess(resilience, {
    operationId: "mockop_stage5close0001",
    evidence: "mock-provider-close-confirmed",
  });
  assert.equal(closeEvidence.ok, true);
  assert.equal(canReleaseOfflineCapacity(closeEvidence.state, "mockop_stage5close0001"), true);

  provider = applyOfflineProviderEvent(provider, {
    event: "session_close_requested",
    sessionId: SESSION,
    sequence: provider.sequence + 1,
  }).adapter;
  provider = applyOfflineProviderEvent(provider, {
    event: "session_close_confirmed",
    sessionId: SESSION,
    sequence: provider.sequence + 1,
    providerReceipt: "mock-only-confirmation",
  }).adapter;
  assert.equal(provider.providerConfirmedClose, true);

  const release = releaseOfflineRuntimeSlot(runtime, { sessionId: SESSION });
  assert.equal(release.ok, true);
  assert.equal(release.released, true);
  assert.equal(release.runtime.activeSessions.length, 0);

  const readiness = evaluateOfflinePilotReadiness({
    architectureContractsValidated: true,
    audioReadinessValidated: true,
    conversationSafetyValidated: true,
    securityResilienceValidated: true,
    integratedAcceptanceValidated: true,
    sameCommitEvidence: true,
    offlineOnly: true,
  });
  assert.equal(readiness.decision.offlineReadiness, true);
  assert.equal(readiness.decision.liveAuthorization, false);
  assert.equal(readiness.decision.maxAuthorizedSpend, 0);
  assert.equal(budget.spentBudgetUnits, 10);
});

test("adversarial inputs fail closed instead of escalating privileges or spend", () => {
  const gapStream = createOfflineAudioStream({ direction: "input" }).stream;
  const gapFrame = createSyntheticOfflineAudioFrame({ sequence: 2, timestampMs: 1_000, direction: "input" }).frame;
  assert.deepEqual(acceptOfflineStreamFrame(gapStream, gapFrame), { ok: false, error: "audio_sequence_gap" });

  const policy = createOfflineToolPolicy({ allowedTools: ["get_verified_material"] }).policy;
  const catalog = createOfflineMaterialCatalog([]).catalog;
  const conversation = createOfflineConversationOrchestrator({
    sessionId: "mock_stage5_adversary01",
    toolPolicy: policy,
    materialCatalog: catalog,
  }).orchestrator;
  const forbiddenTool = handleOfflineModelProposal(conversation, proposal({
    toolCalls: [{ name: "request_human_review", args: {} }],
  }));
  assert.deepEqual(forbiddenTool, { ok: false, error: "tool_not_allowed" });

  const guaranteedYield = handleOfflineModelProposal(conversation, proposal({
    claims: [{
      kind: "yield",
      value: "12% garantizado",
      sourceId: "mocksrc_stage5yield01",
      sourceVersion: "v1",
      verified: true,
      guaranteed: true,
    }],
  }));
  assert.deepEqual(guaranteedYield, { ok: false, error: "unsupported_guarantee" });

  const budget = createOfflineSessionGuard({
    sessionId: "mock_stage5_adversary01",
    startedAt: 1_000,
    maxDurationMs: 10_000,
    maxBudgetUnits: 5,
  }).guard;
  assert.equal(authorizeOfflineSessionStep(budget, { now: 1_100, costUnits: 6 }).error, "session_budget_exceeded");

  const privacy = createOfflinePrivacyGuard({ requireConsent: true }).guard;
  assert.deepEqual(authorizeOfflinePrivacySession(privacy, {
    sessionId: "mock_stage5_adversary01",
    consentGranted: false,
    now: 1_000,
  }), { ok: false, error: "consent_required" });

  let runtime = createOfflineRuntimeGuard().runtime;
  runtime = setOfflineEmergencyStop(runtime, true).runtime;
  assert.equal(claimOfflineRuntimeSlot(runtime, {
    sessionId: "mock_stage5_adversary01",
    actorId: "mockactor_stage5bad001",
    now: 1_000,
  }).error, "emergency_stop_active");

  let resilience = createOfflineResilienceState().state;
  resilience = beginOfflineOperation(resilience, {
    operationId: "mockop_stage5spoof0001",
    sessionId: "mock_stage5_adversary01",
    operationKind: "provider_close",
    now: 1_000,
  }).state;
  assert.equal(recordOfflineOperationSuccess(resilience, {
    operationId: "mockop_stage5spoof0001",
    evidence: "real-looking-but-untrusted",
  }).error, "close_evidence_required");
  assert.equal(canReleaseOfflineCapacity(resilience, "mockop_stage5spoof0001"), false);
});

test("deterministic simulated load completes 100 bounded sessions without leaks", () => {
  let runtime = createOfflineRuntimeGuard({
    maxConcurrent: 5,
    maxStartsPerWindow: 1_000,
    windowMs: 60_000,
  }).runtime;

  for (let index = 0; index < 100; index += 1) {
    const suffix = String(index).padStart(4, "0");
    const sessionId = `mock_load_${suffix}session`;
    const actorId = `mockactor_load_${suffix}`;
    const claim = claimOfflineRuntimeSlot(runtime, { sessionId, actorId, now: 1_000 + index });
    assert.equal(claim.ok, true);
    runtime = claim.runtime;

    const guard = createOfflineSessionGuard({
      sessionId,
      startedAt: 1_000 + index,
      maxDurationMs: 10_000,
      maxBudgetUnits: 10,
    }).guard;
    const step = authorizeOfflineSessionStep(guard, { now: 1_100 + index, costUnits: 1 });
    assert.equal(step.ok, true);
    assert.equal(step.remainingBudgetUnits, 9);

    const release = releaseOfflineRuntimeSlot(runtime, { sessionId });
    assert.equal(release.ok, true);
    assert.equal(release.released, true);
    runtime = release.runtime;
  }

  assert.equal(runtime.activeSessions.length, 0);
  assert.equal(runtime.startEvents.length, 100);
});
