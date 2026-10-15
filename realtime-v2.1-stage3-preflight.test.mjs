import test from "node:test";
import assert from "node:assert/strict";
import {
  STAGE3_AUTHORIZATION,
  STAGE3_PRIMARY_ROUTE,
  evaluateStage3Readiness,
  assertStage3RouteInvariant,
} from "./realtime-v2.1-stage3-preflight.mjs";

function ready(overrides = {}) {
  return {
    direction: "inbound-sip",
    provider: "telnyx",
    targetKind: "internal_test",
    explicitConsent: true,
    allowProspects: false,
    allowClients: false,
    allowColdCalls: false,
    recordAudio: false,
    storeSession: false,
    emergencyStop: false,
    approvedBudgetUsd: 20,
    currentPilotSpendUsd: 0,
    allowedInternalIdentities: 1,
    telnyxAccountReady: true,
    telnyxVoiceNumberReady: true,
    telnyxFqdnConnectionReady: true,
    telnyxNumberAssignedToConnection: true,
    telnyxTranslatedProjectIdConfigured: true,
    tlsEnabled: true,
    srtpMandatory: true,
    compatibleCodecEnabled: true,
    openAiProjectReady: true,
    openAiGptLiveSipAccess: true,
    openAiWebhookReady: true,
    openAiWebhookSecretStored: true,
    openAiApiKeyStored: true,
    cloudflareLabReady: true,
    stage3WorkerDeployed: true,
    killSwitchReady: true,
    monitoringReady: true,
    hangupPathReady: true,
    ...overrides,
  };
}

test("owner authorization is bounded to Telnyx, internal tests and USD 20", () => {
  assert.equal(STAGE3_AUTHORIZATION.ownerAuthorized, true);
  assert.equal(STAGE3_AUTHORIZATION.provider, "telnyx");
  assert.equal(STAGE3_AUTHORIZATION.maxBudgetUsd, 20);
  assert.equal(STAGE3_AUTHORIZATION.prospectsAllowed, false);
  assert.equal(STAGE3_AUTHORIZATION.clientsAllowed, false);
  assert.equal(STAGE3_AUTHORIZATION.coldCallsAllowed, false);
});

test("primary Stage 3 route is inbound Telnyx SIP to GPT-Live", () => {
  assert.equal(assertStage3RouteInvariant(), true);
  assert.equal(STAGE3_PRIMARY_ROUTE.direction, "inbound-sip");
  assert.equal(STAGE3_PRIMARY_ROUTE.carrier, "telnyx");
  assert.equal(STAGE3_PRIMARY_ROUTE.openAiModel, "gpt-live-1");
  assert.equal(STAGE3_PRIMARY_ROUTE.mediaBridge, false);
});

test("missing evidence fails closed", () => {
  const result = evaluateStage3Readiness();
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("telnyx-required"));
  assert.ok(result.reasons.includes("internal-test-only"));
  assert.ok(result.reasons.includes("internal-allowlist-required"));
  assert.ok(result.reasons.includes("missing:telnyxAccountReady"));
  assert.ok(result.reasons.includes("missing:openAiGptLiveSipAccess"));
});

test("fully evidenced inbound route can become ready without outbound SIP permission", () => {
  const result = evaluateStage3Readiness(ready());
  assert.deepEqual(result.reasons, []);
  assert.equal(result.ready, true);
  assert.equal(result.direction, "inbound-sip");
});

test("outbound route remains blocked until extra compatibility evidence exists", () => {
  const result = evaluateStage3Readiness(ready({ direction: "outbound-sip" }));
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("missing:openAiOutboundSipEnabled"));
  assert.ok(result.reasons.includes("missing:telnyxOutboundProfileReady"));
  assert.ok(result.reasons.includes("missing:telnyxSipCredentialsStored"));
  assert.ok(result.reasons.includes("missing:directOutboundCompatibilityValidated"));
});

test("outbound route only passes after all outbound evidence is explicit", () => {
  const result = evaluateStage3Readiness(ready({
    direction: "outbound-sip",
    openAiOutboundSipEnabled: true,
    telnyxOutboundProfileReady: true,
    telnyxSipCredentialsStored: true,
    callerNumberReady: true,
    directOutboundCompatibilityValidated: true,
  }));
  assert.equal(result.ready, true);
});

test("prospects, clients, cold calls, recording and session storage stay forbidden", () => {
  const result = evaluateStage3Readiness(ready({
    allowProspects: true,
    allowClients: true,
    allowColdCalls: true,
    recordAudio: true,
    storeSession: true,
  }));
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("prospects-forbidden"));
  assert.ok(result.reasons.includes("clients-forbidden"));
  assert.ok(result.reasons.includes("cold-calls-forbidden"));
  assert.ok(result.reasons.includes("recording-must-remain-disabled"));
  assert.ok(result.reasons.includes("session-storage-must-remain-disabled"));
});

test("budget cannot exceed owner authorization", () => {
  const result = evaluateStage3Readiness(ready({ approvedBudgetUsd: 20.01 }));
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("owner-budget-cap-exceeded"));
});

test("emergency stop always blocks readiness", () => {
  const result = evaluateStage3Readiness(ready({ emergencyStop: true }));
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("emergency-stop-active-or-unknown"));
});
