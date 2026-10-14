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
- The isolated alarm mock uses a separate DO; its `mock_terminated` status does not release a real reservation.
- Current reservation expiry is fail-closed: it does not automatically free concurrency. A stuck reservation requires audited reconciliation, not manual blind release.
- Do not activate real sessions until end-to-end binding, termination, reconciliation, authenticated operator controls and billing limits have been validated.
