# Stage 4: offline conversation intelligence and orchestration

## 50% prototype milestone
- Deterministic intent routing, ordered turns, irreversible human handoff request.
- Safety gate for verified materials and explicit no-execution decisions.
- Offline unit tests and dedicated GitHub Actions workflow.

## Explicit exclusions
No LLM or real AI inference, no audio, no customer data, no production CRM or WhatsApp, no real scheduling, no human notifications, no external calls, no credentials. A human handoff request is a local decision only.

## Remaining 50%
Add policy-driven simulated dialogue state, adversarial injection tests, turn-to-transport integration and end-to-end mocked scenarios; require all workflows green on same commit.
