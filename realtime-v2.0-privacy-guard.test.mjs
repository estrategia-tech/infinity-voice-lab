import test from "node:test";
import assert from "node:assert/strict";
import {
  appendOfflinePrivacyAudit,
  authorizeOfflinePrivacySession,
  createOfflinePrivacyGuard,
  redactOfflineSensitiveText,
} from "./realtime-v2.0-privacy-guard.mjs";

function fresh(overrides = {}) {
  return createOfflinePrivacyGuard({
    requireConsent: true,
    retentionMs: 5_000,
    maxAuditEvents: 2,
    ...overrides,
  }).guard;
}

test("required simulated consent fails closed before session authorization", () => {
  const guard = fresh();
  assert.deepEqual(authorizeOfflinePrivacySession(guard, {
    sessionId: "mock_privacy_session01",
    consentGranted: false,
    now: 1_000,
  }), { ok: false, error: "consent_required" });
});

test("authorized session records basis without claiming legal consent", () => {
  const result = authorizeOfflinePrivacySession(fresh(), {
    sessionId: "mock_privacy_session01",
    consentGranted: true,
    now: 1_000,
  });
  assert.equal(result.ok, true);
  assert.equal(result.guard.authorizedSessions[0].basis, "simulated_consent");
  assert.equal(result.guard.authorizedSessions[0].sessionId, "mock_privacy_session01");
});

test("audit detail redacts email and phone before storage", () => {
  let guard = authorizeOfflinePrivacySession(fresh(), {
    sessionId: "mock_privacy_session02",
    consentGranted: true,
    now: 1_000,
  }).guard;
  const result = appendOfflinePrivacyAudit(guard, {
    sessionId: "mock_privacy_session02",
    event: "handoff_requested",
    detail: "Contacto lalo@example.com +52 221 577 7772",
    now: 1_100,
  });
  assert.equal(result.ok, true);
  assert.equal(result.entry.detail.includes("lalo@example.com"), false);
  assert.equal(result.entry.detail.includes("221 577 7772"), false);
  assert.equal(result.entry.detail.includes("[REDACTED_EMAIL]"), true);
  assert.equal(result.entry.detail.includes("[REDACTED_PHONE]"), true);
  assert.equal(result.entry.piiStored, false);
});

test("audit is bounded and expired entries are pruned", () => {
  let guard = authorizeOfflinePrivacySession(fresh(), {
    sessionId: "mock_privacy_session03",
    consentGranted: true,
    now: 1_000,
  }).guard;
  for (const [event, now] of [["session_authorized", 1_100], ["provider_failure", 1_200], ["handoff_requested", 1_300]]) {
    guard = appendOfflinePrivacyAudit(guard, {
      sessionId: "mock_privacy_session03",
      event,
      detail: "safe",
      now,
    }).guard;
  }
  assert.equal(guard.auditEvents.length, 2);

  guard = appendOfflinePrivacyAudit(guard, {
    sessionId: "mock_privacy_session03",
    event: "session_closed",
    detail: "safe",
    now: 7_000,
  }).guard;
  assert.equal(guard.auditEvents.length, 1);
  assert.equal(guard.auditEvents[0].event, "session_closed");
});

test("unauthorized sessions cannot append audit events", () => {
  assert.deepEqual(appendOfflinePrivacyAudit(fresh(), {
    sessionId: "mock_privacy_session04",
    event: "policy_denied",
    detail: "safe",
    now: 1_000,
  }), { ok: false, error: "privacy_session_not_authorized" });
});

test("lab-only mode is explicit and redactor is deterministic", () => {
  const guard = fresh({ requireConsent: false });
  const result = authorizeOfflinePrivacySession(guard, {
    sessionId: "mock_privacy_session05",
    consentGranted: false,
    now: 1_000,
  });
  assert.equal(result.ok, true);
  assert.equal(result.guard.authorizedSessions[0].basis, "lab_test_only");
  assert.equal(redactOfflineSensitiveText("a@b.com 555-123-4567"), "[REDACTED_EMAIL] [REDACTED_PHONE]");
});
