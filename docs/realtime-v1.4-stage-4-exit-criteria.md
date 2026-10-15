# Stage 4 offline conversation milestone exit gate

Completion means a deterministic, rule-based **offline conversation prototype**, not an LLM-powered live voice assistant.

## Acceptance
- Five mock intent categories and ordered turn transitions.
- Human handoff decision locks subsequent automated turns.
- Unverified materials withheld; no actual material delivery or handoff.
- Composition with Stage 3 mock transport and Stage 2 mock voice session.
- Adversarial strings, long inputs, replay and disconnection fail closed.
- Eight GitHub Actions workflows green on one final commit (five v1.1, one v1.2, one v1.3, one v1.4).

## Explicit exclusions
No model inference, live audio, speech recognition, real identity verification, cryptographic credentials, real scheduling, customer data, production connections, payments or OpenAI API calls. Tests are mocks; the deterministic intent classifier is not robust natural-language understanding.
