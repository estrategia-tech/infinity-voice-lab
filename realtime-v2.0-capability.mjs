/**
 * Infinity Voice v2.0 — offline signed capability credential.
 *
 * LAB ONLY: keys are generated in memory for tests. This module does not load
 * environment secrets, provider credentials, sockets, fetch, telephony or paid APIs.
 */
import { generateKeyPairSync, sign, verify } from "node:crypto";

const ISSUER = "infinity-voice-lab";
const AUDIENCE = "infinity-voice-mock-provider";
const MAX_TTL_MS = 60_000;
const TOKEN_PREFIX = "ivc1";
const SESSION_RE = /^mock_[a-zA-Z0-9_-]{8,64}$/;
const JTI_RE = /^mockcap_[a-zA-Z0-9_-]{8,64}$/;
const SCOPE_RE = /^voice:[a-z][a-z0-9:_-]{2,63}$/;
const CLAIM_KEYS = ["aud", "exp", "iat", "iss", "jti", "scope", "sid", "v"];

function safeNow(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function exactClaimShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === CLAIM_KEYS.length && keys.every((key, index) => key === CLAIM_KEYS[index]);
}

function validKey(key, type) {
  return key && key.type === type && key.asymmetricKeyType === "ed25519";
}

export function generateEphemeralCapabilityKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return Object.freeze({
    kind: "ephemeral-test-only",
    algorithm: "Ed25519",
    publicKey,
    privateKey,
  });
}

export function issueOfflineCapability({
  privateKey,
  sessionId,
  scope,
  now,
  ttlMs = 30_000,
  jti,
} = {}) {
  if (!validKey(privateKey, "private")) return { ok: false, error: "issuer_key_denied" };
  if (!SESSION_RE.test(sessionId ?? "") || !SCOPE_RE.test(scope ?? "") || !JTI_RE.test(jti ?? "")) {
    return { ok: false, error: "capability_claims_denied" };
  }
  if (!safeNow(now) || !Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > MAX_TTL_MS) {
    return { ok: false, error: "capability_lifetime_denied" };
  }

  const claims = Object.freeze({
    aud: AUDIENCE,
    exp: now + ttlMs,
    iat: now,
    iss: ISSUER,
    jti,
    scope,
    sid: sessionId,
    v: 1,
  });
  const body = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const signature = sign(null, Buffer.from(body, "utf8"), privateKey).toString("base64url");
  return { ok: true, token: `${TOKEN_PREFIX}.${body}.${signature}`, expiresAt: claims.exp };
}

export function verifyOfflineCapability(token, {
  publicKey,
  now,
  expectedSessionId,
  requiredScope,
  replayGuard,
} = {}) {
  if (!validKey(publicKey, "public")) return { ok: false, error: "verifier_key_denied" };
  if (!safeNow(now) || !SESSION_RE.test(expectedSessionId ?? "") || !SCOPE_RE.test(requiredScope ?? "")) {
    return { ok: false, error: "verification_context_denied" };
  }
  if (!(replayGuard instanceof Set)) return { ok: false, error: "replay_guard_required" };
  if (typeof token !== "string" || token.length > 4096) return { ok: false, error: "token_malformed" };

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX || !parts[1] || !parts[2]) {
    return { ok: false, error: "token_malformed" };
  }

  let claims;
  try {
    const verified = verify(
      null,
      Buffer.from(parts[1], "utf8"),
      publicKey,
      Buffer.from(parts[2], "base64url"),
    );
    if (!verified) return { ok: false, error: "signature_denied" };
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "token_malformed" };
  }

  if (!exactClaimShape(claims) || claims.v !== 1 || claims.iss !== ISSUER || claims.aud !== AUDIENCE) {
    return { ok: false, error: "claims_denied" };
  }
  if (!SESSION_RE.test(claims.sid ?? "") || claims.sid !== expectedSessionId ||
      !SCOPE_RE.test(claims.scope ?? "") || claims.scope !== requiredScope ||
      !JTI_RE.test(claims.jti ?? "")) {
    return { ok: false, error: "scope_denied" };
  }
  if (!safeNow(claims.iat) || !safeNow(claims.exp) || claims.exp <= claims.iat ||
      claims.exp - claims.iat > MAX_TTL_MS || now < claims.iat || now >= claims.exp) {
    return { ok: false, error: "lifetime_denied" };
  }
  if (replayGuard.has(claims.jti)) return { ok: false, error: "capability_replayed" };

  replayGuard.add(claims.jti);
  return {
    ok: true,
    capability: Object.freeze({
      sessionId: claims.sid,
      scope: claims.scope,
      expiresAt: claims.exp,
      jti: claims.jti,
    }),
  };
}
