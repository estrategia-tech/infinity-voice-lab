import test from "node:test";
import assert from "node:assert/strict";
import { evaluateOfflinePilotReadiness } from "./realtime-v2.0-pilot-gate.mjs";

function complete(overrides = {}) {
  return {
    architectureContractsValidated: true,
    audioReadinessValidated: true,
    conversationSafetyValidated: true,
    securityResilienceValidated: true,
    integratedAcceptanceValidated: true,
    sameCommitEvidence: true,
    offlineOnly: true,
    ...overrides,
  };
}

test("complete offline evidence still never authorizes live operation", () => {
  const result = evaluateOfflinePilotReadiness(complete());
  assert.equal(result.ok, true);
  assert.equal(result.decision.offlineReadiness, true);
  assert.equal(result.decision.liveAuthorization, false);
  assert.equal(result.decision.productionDeployAllowed, false);
  assert.equal(result.decision.providerConnectionAllowed, false);
  assert.equal(result.decision.realCredentialsAllowed, false);
  assert.equal(result.decision.realCallsAllowed, false);
  assert.equal(result.decision.customerTrafficAllowed, false);
  assert.equal(result.decision.maxAuthorizedSpend, 0);
  assert.equal(result.decision.reason, "separate_live_authorization_required");
});

test("missing validation evidence fails offline readiness", () => {
  const result = evaluateOfflinePilotReadiness(complete({ securityResilienceValidated: false }));
  assert.equal(result.ok, true);
  assert.equal(result.decision.offlineReadiness, false);
  assert.deepEqual(result.decision.failedCriteria, ["securityResilienceValidated"]);
  assert.equal(result.decision.reason, "offline_evidence_incomplete");
});

test("same-commit evidence is mandatory", () => {
  const result = evaluateOfflinePilotReadiness(complete({ sameCommitEvidence: false }));
  assert.equal(result.decision.offlineReadiness, false);
  assert.deepEqual(result.decision.failedCriteria, ["sameCommitEvidence"]);
});

test("offline-only evidence is mandatory and cannot be relabeled live", () => {
  const result = evaluateOfflinePilotReadiness(complete({ offlineOnly: false }));
  assert.equal(result.decision.offlineReadiness, false);
  assert.equal(result.decision.liveAuthorization, false);
});

test("unexpected or malformed evidence is rejected", () => {
  assert.deepEqual(evaluateOfflinePilotReadiness({ ...complete(), liveAuthorization: true }), {
    ok: false,
    error: "invalid_readiness_evidence",
  });
  assert.deepEqual(evaluateOfflinePilotReadiness({ ...complete(), offlineOnly: "yes" }), {
    ok: false,
    error: "invalid_readiness_evidence",
  });
});
