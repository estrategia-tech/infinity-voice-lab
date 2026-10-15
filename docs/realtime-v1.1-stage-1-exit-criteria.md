# Infinity Voice Lab v1.1 — Stage 1 exit gate

Scope: isolated candidate branch `lab/realtime-v1-1-candidate`. This checklist is NOT a production approval.

## Required green checks on the same candidate commit

- Candidate Safety Tests (ledger, coordinator, timeout, alarm, broker boundaries).
- Atomic Claim Local Test (12 concurrent claims: one success, 11 conflicts).
- Bound Release Local Test (no bound release without claim; matching claim + synthetic acknowledgement can release in local DO).
- Real Alarm Local Test (alarm does not assume provider termination).
- Real Durable Object Local Test (reservation persistence, parallel reservations, unified mock, bound release, read-only reconciliation, native alarm across restart, atomic claim).

## Invariants to preserve

- A bound session needs a verified reservation ID, call ID, internal capability, exclusive claim ID, and provider acknowledgement before release.
- `termination_unconfirmed` remains blocked and requires human review. No automatic recovery or storage reset.
- Provider disabled by default. No browser API keys, no OpenAI network calls, no Cloudflare deployment.
- Daily quotas are not refunded by release; an expired unresolved call still consumes concurrency.
- Public routes do not expose ledger internals or local-only test endpoints.

## Gate decision

Stage 1 can be marked **100% complete for the local candidate** only after all five checks above succeed on the same commit and no known high-severity bypass remains. This does **not** authorize actual provider calls or production rollout. Stage 2 requires a separate explicit design review and cost/security approval.
