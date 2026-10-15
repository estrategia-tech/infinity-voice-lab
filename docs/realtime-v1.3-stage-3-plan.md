# Stage 3 — Transport boundary, isolated offline prototype

## Objective
Implement an explicit transport lifecycle and mocked event envelope for future realtime voice. No actual network transport, WebRTC, SIP, microphone, OpenAI credentials, API calls, or provider connections.

## First milestone (20–50%)
- Transport states: disconnected, connecting, connected, interrupted, closed.
- Strict allowed transitions, bounded retry budget, terminal close.
- Mock frame sequence enforcement and rejection of arbitrary payloads.
- Isolated GitHub Actions verification on candidate branch.

## Later milestones
- Simulated timeouts and reconnect policy with injected clock.
- Integration with Stage 2 voice-session state machine.
- Authentication boundary design (server-issued, short-lived, scoped credentials; no client API key).
- Adversarial tests and regression checks on same commit.

## Safety
Work only on lab/realtime-v1-1-candidate. No deployments, secrets, costs, production changes, or real voice connections. Mock transport receipts are not provider acknowledgements and never authorize ledger capacity release.
