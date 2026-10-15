# Infinity Voice Lab v1.1 — Manual recovery runbook (candidate)

**Scope:** isolated local laboratory, synthetic calls only. No Cloudflare deployment, OpenAI Realtime traffic, SIP/phone provider, or production changes.

## Safety invariant

A reserved capacity slot is **never** released because a timer expired, a mock hangup succeeded, a local alarm fired, or an operator assumes the provider disconnected. The provider's termination outcome must be independently verified before a future production-grade release process can be approved. A successful HTTP hangup response alone is not a billing guarantee.

## Incident states

- `pending`: bound call, no termination claim yet.
- `expired_unterminated`: alarm elapsed; reservation remains occupied.
- `alarm_schedule_failed`: expiry alarm could not be scheduled; reservation remains occupied.
- `termination_claimed`: exclusive claim granted; a termination attempt may be in progress.
- `termination_unconfirmed` or `termination_uncertain`: provider outcome not proven; reservation remains occupied and claim cannot be repeated.
- `termination_claim_present`: read-only reconciliation detected a claim regardless of the visible state; requires review.

## Read-only triage

1. Read the internal `/internal/status` through a trusted Durable Object binding only; never expose the binding via a public route. Capture reservation ID, call ID, status, expiry, and `terminationClaimed`.
2. Check local test/CI logs and the termination coordinator outcome. Correlate reservation ID and call ID; do not copy tokens or credentials into incident notes.
3. Mark as `requiresReview` if the provider outcome is missing, ambiguous, or inconsistent. Do not retry termination automatically after an exclusive claim, because a previous attempt may have succeeded.
4. Keep the capacity slot occupied while awaiting independently verifiable provider evidence. Escalate to a human operator.
5. **Stop:** this candidate does not implement a manual override or production recovery endpoint. Do not delete Durable Object storage, reset daily counters, fabricate `providerAcknowledged`, or invoke a release based on this document.

## Acceptance criteria for any future recovery implementation

- Explicit authorized operator identity, reason, and immutable audit trail.
- Evidence from the actual provider that the exact call ID is terminated, with timestamp and correlation.
- Atomic compare-and-set against reservation ID, call ID, claim ID, and expected state.
- Replay resistance and a second confirmation step for ambiguous outcomes.
- Negative tests for wrong identity, forged evidence, concurrent recovery, provider outage, and stale status.
- No automatic release based solely on expiration or a mock acknowledgement.

## Verification

The standalone GitHub Actions `Infinity Voice v1.1 Atomic Claim Local Test` runs 12 concurrent synthetic claims against a real local Wrangler Durable Object. A green result establishes local atomic claim behavior only; it does not verify provider termination or authorize production.
