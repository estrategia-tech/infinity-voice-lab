// Infinity Voice v2.1 — PRE-LIVE ONLY.
// Pure offline policy module. No network, provider SDK, credentials or billable actions.

export const PILOT_ARCHITECTURE = Object.freeze({
  version: "2.1",
  telephonyProvider: "telnyx",
  telephonyTransport: "direct-sip",
  aiProvider: "openai",
  aiProduct: "gpt-live-1",
  controlPlane: "cloudflare-worker-durable-object-planned",
  mediaBridgePrimary: false,
  openAiStoreSession: false,
  recordAudio: false,
});

export const PILOT_LIMITS = Object.freeze({
  designHardCapUsd: 20,
  dailyCapUsd: 5,
  sessionCapUsd: 1,
  maxCallSeconds: 300,
  maxConcurrentCalls: 1,
  maxCallsPerDay: 3,
});

export const DEFAULT_PRELIVE_STATE = Object.freeze({
  liveAuthorization: false,
  approvedBudgetUsd: 0,
  emergencyStop: true,
  allowExternalProspects: false,
  allowColdCalls: false,
  allowedTestNumbers: Object.freeze([]),
});

function finiteNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function isE164(value) {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value);
}

export function evaluateLivePilotAdmission(input = {}) {
  const reasons = [];

  if (input.liveAuthorization !== true) reasons.push("live-authorization-required");
  if (input.ownerApproval !== true) reasons.push("owner-approval-required");
  if (input.privacyOperationalReview !== true) reasons.push("privacy-operational-review-required");
  if (input.providerAccountReady !== true) reasons.push("provider-account-not-ready");
  if (input.openAiOutboundSipEnabled !== true) reasons.push("openai-outbound-sip-not-enabled");
  if (input.secretStoreReady !== true) reasons.push("secret-store-not-ready");
  if (input.killSwitchReady !== true) reasons.push("kill-switch-not-ready");
  if (input.monitoringReady !== true) reasons.push("monitoring-not-ready");
  if (input.emergencyStop !== false) reasons.push("emergency-stop-active-or-unknown");

  if (input.targetKind !== "internal_test") reasons.push("internal-test-only");
  if (input.explicitConsent !== true) reasons.push("explicit-test-consent-required");
  if (input.allowExternalProspects === true) reasons.push("external-prospects-forbidden");
  if (input.allowColdCalls === true) reasons.push("cold-calls-forbidden");
  if (input.recordAudio !== false) reasons.push("recording-must-remain-disabled");
  if (input.storeSession !== false) reasons.push("session-storage-must-remain-disabled");

  const approvedBudgetUsd = finiteNumber(input.approvedBudgetUsd);
  if (approvedBudgetUsd === null || approvedBudgetUsd <= 0) {
    reasons.push("positive-approved-budget-required");
  } else if (approvedBudgetUsd > PILOT_LIMITS.designHardCapUsd) {
    reasons.push("approved-budget-exceeds-design-hard-cap");
  }

  const projectedCallCostUsd = finiteNumber(input.projectedCallCostUsd);
  if (projectedCallCostUsd === null || projectedCallCostUsd < 0) {
    reasons.push("projected-call-cost-required");
  } else if (projectedCallCostUsd > PILOT_LIMITS.sessionCapUsd) {
    reasons.push("session-cost-cap-exceeded");
  }

  const currentDailySpendUsd = finiteNumber(input.currentDailySpendUsd);
  if (currentDailySpendUsd === null || currentDailySpendUsd < 0) {
    reasons.push("daily-spend-required");
  } else if (
    projectedCallCostUsd !== null &&
    currentDailySpendUsd + projectedCallCostUsd > PILOT_LIMITS.dailyCapUsd
  ) {
    reasons.push("daily-cost-cap-exceeded");
  }

  const currentPilotSpendUsd = finiteNumber(input.currentPilotSpendUsd);
  if (currentPilotSpendUsd === null || currentPilotSpendUsd < 0) {
    reasons.push("pilot-spend-required");
  } else if (
    approvedBudgetUsd !== null &&
    projectedCallCostUsd !== null &&
    currentPilotSpendUsd + projectedCallCostUsd > approvedBudgetUsd
  ) {
    reasons.push("approved-pilot-budget-exceeded");
  }

  const requestedCallSeconds = finiteNumber(input.requestedCallSeconds);
  if (requestedCallSeconds === null || requestedCallSeconds <= 0) {
    reasons.push("call-duration-required");
  } else if (requestedCallSeconds > PILOT_LIMITS.maxCallSeconds) {
    reasons.push("call-duration-cap-exceeded");
  }

  const activeCalls = finiteNumber(input.activeCalls);
  if (activeCalls === null || activeCalls < 0) {
    reasons.push("active-call-count-required");
  } else if (activeCalls >= PILOT_LIMITS.maxConcurrentCalls) {
    reasons.push("concurrency-cap-reached");
  }

  const callsToday = finiteNumber(input.callsToday);
  if (callsToday === null || callsToday < 0) {
    reasons.push("daily-call-count-required");
  } else if (callsToday >= PILOT_LIMITS.maxCallsPerDay) {
    reasons.push("daily-call-count-cap-reached");
  }

  if (!isE164(input.destination)) reasons.push("valid-e164-destination-required");

  if (!Array.isArray(input.allowedTestNumbers)) {
    reasons.push("allowlist-required");
  } else if (!input.allowedTestNumbers.includes(input.destination)) {
    reasons.push("destination-not-allowlisted");
  }

  return Object.freeze({
    allowed: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

export function assertArchitectureInvariant(architecture = PILOT_ARCHITECTURE) {
  if (architecture.telephonyProvider !== "telnyx") throw new Error("unexpected-telephony-provider");
  if (architecture.telephonyTransport !== "direct-sip") throw new Error("unexpected-telephony-transport");
  if (architecture.aiProduct !== "gpt-live-1") throw new Error("unexpected-ai-product");
  if (architecture.mediaBridgePrimary !== false) throw new Error("media-bridge-primary-forbidden");
  if (architecture.openAiStoreSession !== false) throw new Error("openai-session-storage-must-be-off");
  if (architecture.recordAudio !== false) throw new Error("recording-must-be-off");
  return true;
}
