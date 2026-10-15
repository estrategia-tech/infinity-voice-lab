// Infinity Voice v2.1 — Stage 3 readiness preflight.
// Pure policy/evidence evaluation. No provider calls, secrets or billable actions.

export const STAGE3_AUTHORIZATION = Object.freeze({
  ownerAuthorized: true,
  authorizationDateLocal: "2026-10-14",
  provider: "telnyx",
  scope: "internal-controlled-tests-only",
  maxBudgetUsd: 20,
  prospectsAllowed: false,
  clientsAllowed: false,
  coldCallsAllowed: false,
});

export const STAGE3_PRIMARY_ROUTE = Object.freeze({
  direction: "inbound-sip",
  carrier: "telnyx",
  mediaPath: "caller-telnyx-openai-gpt-live",
  controlPlane: "cloudflare-worker-durable-object",
  openAiModel: "gpt-live-1",
  sipSignaling: "tls",
  mediaEncryption: "srtp-mandatory",
  mediaBridge: false,
});

const REQUIRED_INBOUND = Object.freeze([
  "telnyxAccountReady",
  "telnyxVoiceNumberReady",
  "telnyxFqdnConnectionReady",
  "telnyxNumberAssignedToConnection",
  "telnyxTranslatedProjectIdConfigured",
  "tlsEnabled",
  "srtpMandatory",
  "compatibleCodecEnabled",
  "openAiProjectReady",
  "openAiGptLiveSipAccess",
  "openAiWebhookReady",
  "openAiWebhookSecretStored",
  "openAiApiKeyStored",
  "cloudflareLabReady",
  "stage3WorkerDeployed",
  "killSwitchReady",
  "monitoringReady",
  "hangupPathReady",
]);

const REQUIRED_OUTBOUND_EXTRA = Object.freeze([
  "openAiOutboundSipEnabled",
  "telnyxOutboundProfileReady",
  "telnyxSipCredentialsStored",
  "callerNumberReady",
  "directOutboundCompatibilityValidated",
]);

function finiteNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function addMissing(reasons, evidence, keys) {
  for (const key of keys) {
    if (evidence[key] !== true) reasons.push(`missing:${key}`);
  }
}

export function evaluateStage3Readiness(evidence = {}) {
  const reasons = [];
  const direction = evidence.direction ?? STAGE3_PRIMARY_ROUTE.direction;

  if (STAGE3_AUTHORIZATION.ownerAuthorized !== true) reasons.push("owner-authorization-missing");
  if (STAGE3_AUTHORIZATION.provider !== "telnyx") reasons.push("unexpected-provider");
  if (evidence.provider !== "telnyx") reasons.push("telnyx-required");
  if (!['inbound-sip', 'outbound-sip'].includes(direction)) reasons.push("unsupported-direction");

  if (evidence.targetKind !== "internal_test") reasons.push("internal-test-only");
  if (evidence.explicitConsent !== true) reasons.push("explicit-internal-consent-required");
  if (evidence.allowProspects === true) reasons.push("prospects-forbidden");
  if (evidence.allowClients === true) reasons.push("clients-forbidden");
  if (evidence.allowColdCalls === true) reasons.push("cold-calls-forbidden");
  if (evidence.recordAudio !== false) reasons.push("recording-must-remain-disabled");
  if (evidence.storeSession !== false) reasons.push("session-storage-must-remain-disabled");
  if (evidence.emergencyStop !== false) reasons.push("emergency-stop-active-or-unknown");

  const approvedBudgetUsd = finiteNumber(evidence.approvedBudgetUsd);
  if (approvedBudgetUsd === null || approvedBudgetUsd <= 0) {
    reasons.push("positive-approved-budget-required");
  } else if (approvedBudgetUsd > STAGE3_AUTHORIZATION.maxBudgetUsd) {
    reasons.push("owner-budget-cap-exceeded");
  }

  const currentPilotSpendUsd = finiteNumber(evidence.currentPilotSpendUsd);
  if (currentPilotSpendUsd === null || currentPilotSpendUsd < 0) {
    reasons.push("pilot-spend-evidence-required");
  } else if (currentPilotSpendUsd >= STAGE3_AUTHORIZATION.maxBudgetUsd) {
    reasons.push("owner-budget-exhausted");
  }

  const allowedInternalIdentities = finiteNumber(evidence.allowedInternalIdentities);
  if (allowedInternalIdentities === null || allowedInternalIdentities < 1) {
    reasons.push("internal-allowlist-required");
  }

  addMissing(reasons, evidence, REQUIRED_INBOUND);

  if (direction === "outbound-sip") {
    addMissing(reasons, evidence, REQUIRED_OUTBOUND_EXTRA);
  }

  return Object.freeze({
    ready: reasons.length === 0,
    direction,
    provider: "telnyx",
    authorizationScope: STAGE3_AUTHORIZATION.scope,
    maxBudgetUsd: STAGE3_AUTHORIZATION.maxBudgetUsd,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

export function assertStage3RouteInvariant(route = STAGE3_PRIMARY_ROUTE) {
  if (route.direction !== "inbound-sip") throw new Error("stage3-primary-route-must-be-inbound-sip");
  if (route.carrier !== "telnyx") throw new Error("stage3-carrier-must-be-telnyx");
  if (route.openAiModel !== "gpt-live-1") throw new Error("stage3-model-must-be-gpt-live-1");
  if (route.sipSignaling !== "tls") throw new Error("stage3-sip-must-use-tls");
  if (route.mediaEncryption !== "srtp-mandatory") throw new Error("stage3-media-must-require-srtp");
  if (route.mediaBridge !== false) throw new Error("stage3-primary-media-bridge-forbidden");
  return true;
}
