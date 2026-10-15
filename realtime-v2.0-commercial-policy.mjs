/**
 * Infinity Voice v2.0 — offline commercial-claim safety policy.
 * Structured claims only. No inventory lookup, publication or customer action.
 */
const GUARANTEE_SENSITIVE = new Set(["delivery_date", "yield", "appreciation"]);
const ALLOWED_KINDS = new Set(["price", "availability", "delivery_date", "yield", "appreciation", "feature"]);

export function evaluateOfflineCommercialClaims(claims) {
  if (!Array.isArray(claims) || claims.length > 8) return { ok: false, error: "invalid_commercial_claims" };
  const safeClaims = [];
  const heldClaims = [];
  for (const claim of claims) {
    if (!claim || typeof claim !== "object" || !ALLOWED_KINDS.has(claim.kind) || typeof claim.value !== "string" ||
        typeof claim.sourceId !== "string" || typeof claim.sourceVersion !== "string" ||
        typeof claim.verified !== "boolean" || typeof claim.guaranteed !== "boolean") {
      return { ok: false, error: "invalid_commercial_claim" };
    }
    if (GUARANTEE_SENSITIVE.has(claim.kind) && claim.guaranteed) {
      return { ok: false, error: "unsupported_guarantee" };
    }
    if (!claim.verified) {
      heldClaims.push(Object.freeze({ kind: claim.kind, reason: "source_not_verified" }));
      continue;
    }
    safeClaims.push(Object.freeze({
      kind: claim.kind,
      value: claim.value,
      sourceId: claim.sourceId,
      sourceVersion: claim.sourceVersion,
      qualification: GUARANTEE_SENSITIVE.has(claim.kind) ? "documented_not_guaranteed" : "verified_source",
    }));
  }
  return {
    ok: true,
    disposition: heldClaims.length ? "partial_hold_for_verification" : "verified_claims_only",
    safeClaims: Object.freeze(safeClaims),
    heldClaims: Object.freeze(heldClaims),
    execute: false,
  };
}

export function evaluateOfflineHandoff({ requested = false, humanAvailable = false } = {}) {
  if (typeof requested !== "boolean" || typeof humanAvailable !== "boolean") {
    return { ok: false, error: "invalid_handoff_context" };
  }
  if (!requested) return { ok: true, disposition: "no_handoff", execute: false, lockConversation: false };
  return {
    ok: true,
    disposition: humanAvailable ? "handoff_eligible" : "handoff_pending",
    execute: false,
    lockConversation: true,
  };
}
