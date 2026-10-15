# Stage 2 — Offline voice engine (candidate)

## Goal and scope
Prototype a deterministic voice-session control plane without connecting to OpenAI Realtime or any telephony provider. This is not an audio engine and cannot initiate calls.

## 20–50% milestone
1. Offline state machine: idle → admitted → negotiating → active → terminating → terminated, with fail-closed termination_unconfirmed.
2. Deterministic unit tests for valid and invalid transitions.
3. Independent GitHub Actions check, no API secrets or external transport.
4. Public snapshot exposes state/revision/review flag only.

## Remaining before 50% of stage 2
- Add bounded turn/event queue with overflow rejection and backpressure.
- Add mock audio-event contract (no microphone/network).
- Test duplicate, out-of-order, and replayed events.
- Verify all new checks green on the same commit.

## Safety boundaries
Do not modify main, production, Cloudflare, Infinity Hub, Meta or WhatsApp. No OpenAI requests, real calls, SIP, paid services or live credentials. Session state alone is never evidence of provider termination; stage 1 Durable Object remains the authority for reservation and release.
