import test from "node:test";
import assert from "node:assert/strict";
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

const SESSION = "mock_stage4_integrated01";

test("bounded offline session can progress only through all stage4 guards", () => {
  let runtime = createOfflineRuntimeGuard({ maxConcurrent: 1, maxStartsPerWindow: 2, windowMs: 10_000 }).runtime;
  runtime = claimOfflineRuntimeSlot(runtime, {
    sessionId: SESSION,
    actorId: "mockactor_integrated01",
    now: 1_000,
  }).runtime;

  let session = createOfflineSessionGuard({
    sessionId: SESSION,
    startedAt: 1_000,
    maxDurationMs: 10_000,
    maxBudgetUnits: 100,
  }).guard;
  const step = authorizeOfflineSessionStep(session, { now: 2_000, costUnits: 25 });
  assert.equal(step.ok, true);
  session = step.guard;
  assert.equal(session.spentBudgetUnits, 25);

  let privacy = createOfflinePrivacyGuard({ requireConsent: true, retentionMs: 10_000, maxAuditEvents: 5 }).guard;
  privacy = authorizeOfflinePrivacySession(privacy, {
    sessionId: SESSION,
    consentGranted: true,
    now: 1_000,
  }).guard;
  const audit = appendOfflinePrivacyAudit(privacy, {
    sessionId: SESSION,
    event: "handoff_requested",
    detail: "correo prueba@example.com teléfono +52 221 577 7772",
    now: 2_100,
  });
  assert.equal(audit.ok, true);
  assert.equal(audit.entry.detail.includes("prueba@example.com"), false);

  let resilience = createOfflineResilienceState({ maxRetries: 1, baseRetryDelayMs: 500 }).state;
  resilience = beginOfflineOperation(resilience, {
    operationId: "mockop_integrated_close01",
    sessionId: SESSION,
    operationKind: "provider_close",
    now: 3_000,
  }).state;
  const close = recordOfflineOperationSuccess(resilience, {
    operationId: "mockop_integrated_close01",
    evidence: "mock-provider-close-confirmed",
  });
  assert.equal(close.ok, true);
  assert.equal(canReleaseOfflineCapacity(close.state, "mockop_integrated_close01"), true);

  const released = releaseOfflineRuntimeSlot(runtime, { sessionId: SESSION });
  assert.equal(released.ok, true);
  assert.equal(released.released, true);
  assert.equal(released.runtime.activeSessions.length, 0);
});

test("adversarial path fails closed across cost privacy runtime and close evidence", () => {
  let session = createOfflineSessionGuard({
    sessionId: "mock_stage4_adversary01",
    startedAt: 1_000,
    maxDurationMs: 5_000,
    maxBudgetUnits: 10,
  }).guard;
  const overBudget = authorizeOfflineSessionStep(session, { now: 2_000, costUnits: 11 });
  assert.equal(overBudget.ok, false);
  assert.equal(overBudget.error, "session_budget_exceeded");

  const privacy = createOfflinePrivacyGuard({ requireConsent: true }).guard;
  assert.deepEqual(authorizeOfflinePrivacySession(privacy, {
    sessionId: "mock_stage4_adversary01",
    consentGranted: false,
    now: 1_000,
  }), { ok: false, error: "consent_required" });

  let runtime = createOfflineRuntimeGuard().runtime;
  runtime = setOfflineEmergencyStop(runtime, true).runtime;
  assert.deepEqual(claimOfflineRuntimeSlot(runtime, {
    sessionId: "mock_stage4_adversary01",
    actorId: "mockactor_adversary01",
    now: 1_000,
  }), { ok: false, error: "emergency_stop_active" });

  let resilience = createOfflineResilienceState().state;
  resilience = beginOfflineOperation(resilience, {
    operationId: "mockop_adversary_close01",
    sessionId: "mock_stage4_adversary01",
    operationKind: "provider_close",
    now: 1_000,
  }).state;
  assert.deepEqual(recordOfflineOperationSuccess(resilience, {
    operationId: "mockop_adversary_close01",
    evidence: "spoofed-real-proof",
  }), { ok: false, error: "close_evidence_required" });
  assert.equal(canReleaseOfflineCapacity(resilience, "mockop_adversary_close01"), false);
});
