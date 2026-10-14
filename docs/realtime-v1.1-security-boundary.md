# Infinity Voice v1.1 — HTTP boundary and capability model (candidate)

**Status:** offline-only; no production deployment, no real provider requests.

## Public surface
The public candidate broker exposes only GET `/health` and a permanently disabled POST `/api/realtime/session`. All `/internal/*`, `/__local/*`, hangup and release paths return 404. Public origin validation is **not authentication**.

## Private surface
`LabSessionLedger` has internal Durable Object endpoints for reservation, binding and release. The DO stub must remain reachable **only** through trusted server-side code, never via a public proxy. Bound-call release requires a server-only `INTERNAL_RELEASE_TOKEN`, matching `callId`, and `providerAcknowledged:true`. The flag alone is not proof of provider termination: only the trusted coordinator may assert it after the provider API responds.

## Security limitations before real calls
- The local harness exposes `/__local/*` and uses a **synthetic committed token**. It must never be deployed.
- The synthetic local `x-local-test` header is not a production authorization control.
- A token comparison cannot stop a malicious or compromised trusted Worker from falsely asserting termination.
- Production capability must be stored in Cloudflare secrets, never source, browser, GitHub workflow logs, or client response.
- The primary reservation DO now schedules its own expiry alarm when a call is bound. That alarm only marks `expired_unterminated`; it does not contact OpenAI or release capacity. The separate historical alarm mock remains isolated; its `mock_terminated` status does not release a real reservation.
- Current reservation expiry and alarm-scheduling failure are fail-closed: neither automatically frees concurrency. A stuck reservation requires audited reconciliation, not manual blind release.
- Do not activate real sessions until end-to-end binding, termination, reconciliation, authenticated operator controls and billing limits have been validated.

## Provider termination ownership preflight
`safeTerminateBoundCall` is an offline-only strict wrapper: it checks the private reservation ledger for an exact reservationId/callId match and acceptable state **before** the hangup adapter may run. A missing ledger, mismatch, or invalid state fails closed without touching the provider. Tests use an injected synthetic transport.

**Remaining race:** the status preflight and the eventual provider hangup are not an atomic operation. Before paid calls, implement an atomic claim/lease in the same Durable Object (or equivalent serialization), an idempotency policy, and a retry/reconciliation procedure. Never expose the low-level `terminateAndRelease` adapter directly to a client.

## Atomic termination claim (offline candidate)
`/internal/claim-termination` atomically checks the exact bound call and acquires a single-use claim ID within the reservation Durable Object. It requires the internal release capability. Concurrent claims fail with `termination_already_claimed`. The trusted `terminateClaimedCall` orchestrator invokes the injected provider adapter only after obtaining the claim and then calls `/internal/finish-termination`.

When the provider does not acknowledge termination, `finish-termination` marks `termination_uncertain` and retains capacity. If the coordinator crashes after claiming, the reservation remains in `termination_claimed` and capacity is **not** automatically released. Both states require operator review; they are not evidence of a stopped provider call.

**Remaining controls before paid use:** an authenticated, auditable recovery workflow for stuck claims; idempotent handling of retries; evidence-backed provider termination; secret provisioning and end-to-end operator authorization. The older `/internal/release` and low-level termination adapter remain available for offline compatibility and must not be wired to public routes.
