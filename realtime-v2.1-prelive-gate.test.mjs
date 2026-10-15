import test from "node:test";
import assert from "node:assert/strict";
import {
  PILOT_ARCHITECTURE,
  PILOT_LIMITS,
  DEFAULT_PRELIVE_STATE,
  evaluateLivePilotAdmission,
  assertArchitectureInvariant,
} from "./realtime-v2.1-prelive-gate.mjs";

const INTERNAL = "+525577873801";

function approved(overrides = {}) {
  return {
    liveAuthorization: true,
    ownerApproval: true,
    legalPrivacyReview: true,
    providerAccountReady: true,
    openAiOutboundSipEnabled: true,
    secretStoreReady: true,
    killSwitchReady: true,
    monitoringReady: true,
    emergencyStop: false,
    targetKind: "internal_test",
    explicitConsent: true,
    allowExternalProspects: false,
    allowColdCalls: false,
    recordAudio: false,
    storeSession: false,
    approvedBudgetUsd: 20,
    projectedCallCostUsd: 0.75,
    currentDailySpendUsd: 0,
    currentPilotSpendUsd: 0,
    requestedCallSeconds: 300,
    activeCalls: 0,
    callsToday: 0,
    destination: INTERNAL,
    allowedTestNumbers: [INTERNAL],
    ...overrides,
  };
}

test("default pre-live state is hard fail-closed with zero spend", () => {
  assert.equal(DEFAULT_PRELIVE_STATE.liveAuthorization, false);
  assert.equal(DEFAULT_PRELIVE_STATE.approvedBudgetUsd, 0);
  assert.equal(DEFAULT_PRELIVE_STATE.emergencyStop, true);
  assert.deepEqual(DEFAULT_PRELIVE_STATE.allowedTestNumbers, []);
  const result = evaluateLivePilotAdmission();
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("live-authorization-required"));
  assert.ok(result.reasons.includes("positive-approved-budget-required"));
  assert.ok(result.reasons.includes("destination-not-allowlisted"));
});

test("architecture invariant locks the recommended pre-live route", () => {
  assert.equal(assertArchitectureInvariant(), true);
  assert.equal(PILOT_ARCHITECTURE.telephonyProvider, "telnyx");
  assert.equal(PILOT_ARCHITECTURE.telephonyTransport, "direct-sip");
  assert.equal(PILOT_ARCHITECTURE.aiProduct, "gpt-live-1");
  assert.equal(PILOT_ARCHITECTURE.mediaBridgePrimary, false);
  assert.equal(PILOT_ARCHITECTURE.openAiStoreSession, false);
  assert.equal(PILOT_ARCHITECTURE.recordAudio, false);
});

test("fully approved internal test can pass policy without performing any call", () => {
  const result = evaluateLivePilotAdmission(approved());
  assert.deepEqual(result, { allowed: true, reasons: [] });
});

test("external prospect and cold-call targets are denied even with other approvals", () => {
  const result = evaluateLivePilotAdmission(
    approved({ targetKind: "prospect", allowExternalProspects: true, allowColdCalls: true }),
  );
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("internal-test-only"));
  assert.ok(result.reasons.includes("external-prospects-forbidden"));
  assert.ok(result.reasons.includes("cold-calls-forbidden"));
});

test("owner approval, legal review, secret store, kill switch and monitoring are mandatory", () => {
  const result = evaluateLivePilotAdmission(
    approved({
      ownerApproval: false,
      legalPrivacyReview: false,
      secretStoreReady: false,
      killSwitchReady: false,
      monitoringReady: false,
    }),
  );
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("owner-approval-required"));
  assert.ok(result.reasons.includes("legal-privacy-review-required"));
  assert.ok(result.reasons.includes("secret-store-not-ready"));
  assert.ok(result.reasons.includes("kill-switch-not-ready"));
  assert.ok(result.reasons.includes("monitoring-not-ready"));
});

test("emergency stop, recording or session storage block admission", () => {
  const result = evaluateLivePilotAdmission(
    approved({ emergencyStop: true, recordAudio: true, storeSession: true }),
  );
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("emergency-stop-active-or-unknown"));
  assert.ok(result.reasons.includes("recording-must-remain-disabled"));
  assert.ok(result.reasons.includes("session-storage-must-remain-disabled"));
});

test("budget, duration, concurrency and daily-count caps fail closed", () => {
  const result = evaluateLivePilotAdmission(
    approved({
      approvedBudgetUsd: PILOT_LIMITS.designHardCapUsd + 1,
      projectedCallCostUsd: PILOT_LIMITS.sessionCapUsd + 0.01,
      currentDailySpendUsd: PILOT_LIMITS.dailyCapUsd,
      currentPilotSpendUsd: PILOT_LIMITS.designHardCapUsd,
      requestedCallSeconds: PILOT_LIMITS.maxCallSeconds + 1,
      activeCalls: PILOT_LIMITS.maxConcurrentCalls,
      callsToday: PILOT_LIMITS.maxCallsPerDay,
    }),
  );
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("approved-budget-exceeds-design-hard-cap"));
  assert.ok(result.reasons.includes("session-cost-cap-exceeded"));
  assert.ok(result.reasons.includes("daily-cost-cap-exceeded"));
  assert.ok(result.reasons.includes("approved-pilot-budget-exceeded"));
  assert.ok(result.reasons.includes("call-duration-cap-exceeded"));
  assert.ok(result.reasons.includes("concurrency-cap-reached"));
  assert.ok(result.reasons.includes("daily-call-count-cap-reached"));
});

test("destination must be E.164 and explicitly allowlisted", () => {
  const malformed = evaluateLivePilotAdmission(approved({ destination: "5577873801" }));
  assert.equal(malformed.allowed, false);
  assert.ok(malformed.reasons.includes("valid-e164-destination-required"));
  assert.ok(malformed.reasons.includes("destination-not-allowlisted"));

  const unlisted = evaluateLivePilotAdmission(approved({ allowedTestNumbers: ["+522215777772"] }));
  assert.equal(unlisted.allowed, false);
  assert.ok(unlisted.reasons.includes("destination-not-allowlisted"));
});
