# Infinity Voice v1.1 — criteria for the first paid voice test

**Status:** BLOCKED. No deployment, OpenAI calls, or purchase authorized.

## Already tested
- Fail-closed broker with origin + bearer authorization.
- Offline unified SDP validation and mock provider.
- Real local Cloudflare Durable Object persistence, concurrency and release.
- Browser disabled by default.
- Mock rollback checks successful release receipt.

## Not demonstrated
- Actual Realtime WebRTC negotiation and browser audio.
- Server-side termination of a live OpenAI Realtime call.
- Provider-side billing ceiling or real-time spend metering.
- Recovery after client crash, network partition, missing provider termination acknowledgement, or worker restart.
- End-to-end server authentication suitable for public browser clients (a shared bearer token must never be embedded in frontend JavaScript).
- Current price/model availability and account budget settings.

## Release decision
Do not switch the browser gate or broker to enabled. A successful mock does not authorize real traffic.
Before a paid test, document the current OpenAI protocol, the authoritative termination mechanism, a user-approved maximum exposure, isolated API credentials and monitoring, and a verified kill switch. If a provider-side hard cap cannot be proven, clearly disclose that risk and request explicit user approval for a strictly bounded test.
No voice call should involve a real client or personal data during validation.
