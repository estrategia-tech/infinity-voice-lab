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
const CONTEXT_RE = /^mockctx_[a-zA-Z0-9_-]{8,64}$/;
const ORIGIN_RE = /^lab:\/\/[a-z0-9.-]{3,80}$/;
const JTI_RE = /^mockcap_[a-zA-Z0-9_-]{8,64}$/;
const SCOPE_RE = /^voice:[a-z][a-z0-9:_-]{2,63}$/;
const CLAIM_KEYS = ["aud", "ctx", "exp", "iat", "iss", "jti", "origin", "scope", "sid", "v"];

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

function validScopePolicy(policy, scope) {
  return policy instanceof Set && [...policy].every((item) => SCOPE_RE.test(item)) && policy.has(scope);
}

function validRegistry(registry) {
  return registry?.kind === "offline-revocation-registry" && registry.revoked instanceof Map;
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

export function createOfflineRevocationRegistry() {
  return Object.freeze({ kind: "offline-revocation-registry", revoked: new Map() });
}

export function revokeOfflineCapability(registry, { jti, now, reason = "manual" } = {}) {
  if (!validRegistry(registry)) return { ok: false, error: "revocation_registry_required" };
  if (!JTI_RE.test(jti ?? "") || !safeNow(now) || typeof reason !== "string" || reason.length < 1 || reason.length > 80) {
    return { ok: false, error: "revocation_request_denied" };
  }
  if (!registry.revoked.has(jti)) registry.revoked.set(jti, Object.freeze({ revokedAt: now, reason }));
  return { ok: true, jti, revocation: registry.revoked.get(jti) };
}

export function issueOfflineCapability({
  privateKey,
  sessionId,
  contextId,
  origin,
  scope,
  authorizedScopes,
  now,
  ttlMs = 30_000,
  jti,
} = {}) {
  if (!validKey(privateKey, "private")) return { ok: false, error: "issuer_key_denied" };
  if (!SESSION_RE.test(sessionId ?? "") || !CONTEXT_RE.test(contextId ?? "") || !ORIGIN_RE.test(origin ?? "") ||
      !SCOPE_RE.test(scope ?? "") || !JTI_RE.test(jti ?? "")) {
    return { ok: false, error: "capability_claims_denied" };
  }
  if (!validScopePolicy(authorizedScopes, scope)) return { ok: false, error: "authorization_policy_denied" };
  if (!safeNow(now) || !Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > MAX_TTL_MS) {
    return { ok: false, error: "capability_lifetime_denied" };
  }

  const claims = Object.freeze({
    aud: AUDIENCE,
    ctx: contextId,
    exp: now + ttlMs,
    iat: now,
    iss: ISSUER,
    jti,
    origin,
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
  expectedContextId,
  expectedOrigin,
  requiredScope,
  allowedScopes,
  replayGuard,
  revocationRegistry,
} = {}) {
  if (!validKey(publicKey, "public")) return { ok: false, error: "verifier_key_denied" };
  if (!safeNow(now) || !SESSION_RE.test(expectedSessionId ?? "") || !CONTEXT_RE.test(expectedContextId ?? "") ||
      !ORIGIN_RE.test(expectedOrigin ?? "") || !SCOPE_RE.test(requiredScope ?? "")) {
    return { ok: false, error: "verification_context_denied" };
  }
  if (!validScopePolicy(allowedScopes, requiredScope)) return { ok: false, error: "authorization_policy_denied" };
  if (!(replayGuard instanceof Set)) return { ok: false, error: "replay_guard_required" };
  if (!validRegistry(revocationRegistry)) return { ok: false, error: "revocation_registry_required" };
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
      !CONTEXT_RE.test(claims.ctx ?? "") || claims.ctx !== expectedContextId ||
      !ORIGIN_RE.test(claims.origin ?? "") || claims.origin !== expectedOrigin) {
    return { ok: false, error: "binding_denied" };
  }
  if (!SCOPE_RE.test(claims.scope ?? "") || claims.scope !== requiredScope || !allowedScopes.has(claims.scope) ||
      !JTI_RE.test(claims.jti ?? "")) {
    return { ok: false, error: "scope_denied" };
  }
  if (!safeNow(claims.iat) || !safeNow(claims.exp) || claims.exp <= claims.iat ||
      claims.exp - claims.iat > MAX_TTL_MS || now < claims.iat || now >= claims.exp) {
    return { ok: false, error: "lifetime_denied" };
  }
  if (revocationRegistry.revoked.has(claims.jti)) return { ok: false, error: "capability_revoked" };
  if (replayGuard.has(claims.jti)) return { ok: false, error: "capability_replayed" };

  replayGuard.add(claims.jti);
  return {
    ok: true,
    capability: Object.freeze({
      sessionId: claims.sid,
      contextId: claims.ctx,
      origin: claims.origin,
      scope: claims.scope,
      expiresAt: claims.exp,
      jti: claims.jti,
    }),
  };
}
