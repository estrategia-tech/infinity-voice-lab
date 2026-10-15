/**
 * Infinity Voice v2.0 — offline pilot-readiness evidence gate.
 *
 * This module can only assess OFFLINE preparation evidence. It can never
 * authorize production, live traffic, providers, credentials, telephony or spend.
 */
const REQUIRED = Object.freeze([
  "architectureContractsValidated",
  "audioReadinessValidated",
  "conversationSafetyValidated",
  "securityResilienceValidated",
  "integratedAcceptanceValidated",
  "sameCommitEvidence",
  "offlineOnly",
]);

function exactEvidence(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const wanted = [...REQUIRED].sort();
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]) &&
    REQUIRED.every((key) => typeof value[key] === "boolean");
}

export function evaluateOfflinePilotReadiness(evidence) {
  if (!exactEvidence(evidence)) return { ok: false, error: "invalid_readiness_evidence" };

  const failedCriteria = REQUIRED.filter((key) => evidence[key] !== true);
  const offlineReady = failedCriteria.length === 0;
  return {
    ok: true,
    decision: Object.freeze({
      offlineReadiness: offlineReady,
      failedCriteria: Object.freeze(failedCriteria),
      liveAuthorization: false,
      productionDeployAllowed: false,
      providerConnectionAllowed: false,
      realCredentialsAllowed: false,
      realCallsAllowed: false,
      customerTrafficAllowed: false,
      maxAuthorizedSpend: 0,
      reason: offlineReady ? "separate_live_authorization_required" : "offline_evidence_incomplete",
    }),
  };
}
