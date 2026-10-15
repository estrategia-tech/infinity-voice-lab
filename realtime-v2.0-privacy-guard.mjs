/**
 * Infinity Voice v2.0 — offline privacy/minimization guard.
 * Design contract only: no legal consent record, storage backend, network or PII persistence.
 */
const SESSION_RE = /^mock_[a-zA-Z0-9_-]{8,64}$/;
const EVENTS = new Set([
  "session_authorized",
  "policy_denied",
  "handoff_requested",
  "provider_failure",
  "session_closed",
]);
const MAX_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function safeInt(value, min = 0) {
  return Number.isSafeInteger(value) && value >= min;
}

function validGuard(guard) {
  return guard?.kind === "offline-privacy-guard" && typeof guard.requireConsent === "boolean" &&
    safeInt(guard.retentionMs, 1_000) && guard.retentionMs <= MAX_RETENTION_MS &&
    safeInt(guard.maxAuditEvents, 1) && guard.maxAuditEvents <= 10_000 &&
    Array.isArray(guard.authorizedSessions) && Array.isArray(guard.auditEvents);
}

export function redactOfflineSensitiveText(value) {
  if (typeof value !== "string") return "";
  return value
    .slice(0, 2_000)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, "[REDACTED_PHONE]");
}

export function createOfflinePrivacyGuard({
  requireConsent = true,
  retentionMs = 86_400_000,
  maxAuditEvents = 100,
} = {}) {
  if (typeof requireConsent !== "boolean" || !safeInt(retentionMs, 1_000) || retentionMs > MAX_RETENTION_MS ||
      !safeInt(maxAuditEvents, 1) || maxAuditEvents > 10_000) {
    return { ok: false, error: "invalid_privacy_guard_config" };
  }
  return {
    ok: true,
    guard: Object.freeze({
      kind: "offline-privacy-guard",
      requireConsent,
      retentionMs,
      maxAuditEvents,
      authorizedSessions: Object.freeze([]),
      auditEvents: Object.freeze([]),
      sequence: 0,
    }),
  };
}

export function authorizeOfflinePrivacySession(guard, {
  sessionId,
  consentGranted,
  now,
} = {}) {
  if (!validGuard(guard) || !SESSION_RE.test(sessionId ?? "") || typeof consentGranted !== "boolean" || !safeInt(now)) {
    return { ok: false, error: "invalid_privacy_authorization" };
  }
  if (guard.requireConsent && !consentGranted) return { ok: false, error: "consent_required" };
  if (guard.authorizedSessions.some((item) => item.sessionId === sessionId)) {
    return { ok: true, alreadyAuthorized: true, guard };
  }
  const authorization = Object.freeze({
    sessionId,
    authorizedAt: now,
    basis: guard.requireConsent ? "simulated_consent" : "lab_test_only",
  });
  return {
    ok: true,
    alreadyAuthorized: false,
    guard: Object.freeze({
      ...guard,
      authorizedSessions: Object.freeze([...guard.authorizedSessions, authorization]),
      sequence: guard.sequence + 1,
    }),
  };
}

export function appendOfflinePrivacyAudit(guard, {
  sessionId,
  event,
  detail = "",
  now,
} = {}) {
  if (!validGuard(guard) || !SESSION_RE.test(sessionId ?? "") || !EVENTS.has(event) ||
      typeof detail !== "string" || !safeInt(now)) {
    return { ok: false, error: "invalid_privacy_audit" };
  }
  if (!guard.authorizedSessions.some((item) => item.sessionId === sessionId)) {
    return { ok: false, error: "privacy_session_not_authorized" };
  }
  const retained = guard.auditEvents.filter((item) => now - item.at < guard.retentionMs);
  const entry = Object.freeze({
    sequence: guard.sequence + 1,
    sessionId,
    event,
    detail: redactOfflineSensitiveText(detail),
    at: now,
    piiStored: false,
  });
  const bounded = [...retained, entry].slice(-guard.maxAuditEvents);
  return {
    ok: true,
    entry,
    guard: Object.freeze({
      ...guard,
      auditEvents: Object.freeze(bounded),
      sequence: guard.sequence + 1,
    }),
  };
}
