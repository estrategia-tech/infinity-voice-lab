# Stage 3 exit gate — offline transport only

Stage 3 scope is **mock transport boundary**, not real-time network connectivity.

## Verified components to require
- Transport states and bounded retry attempts.
- Sequence-checked metadata-only mock frames.
- Stage 2 session integration and recovery from simulated drops.
- Deterministic injected-clock timeout decisions; exhaustion requires manual review.
- Strict **local-test-only** capability shape and session scoping. This is NOT real authentication or cryptographic validation.
- No real provider, WebRTC, microphone, OpenAI credentials, network transport or deployment.

## Approval gate
Stage 3 may be called 100% for the offline transport prototype only if the Stage 3 workflow, Stage 2 workflow and all five Stage 1 workflows are successful **on the same final commit**. All mock authorization must remain disabled as a production credential path.

## Future live transport requirements
Before any actual connection, separately design and validate cryptographic authentication, secure credential issuance, session revocation, origin controls, quotas, telemetry without personal data, live latency measurements, and explicit cost authorization. A mock transport receipt is never a provider hangup acknowledgement.
