# Stage 2 completion gate — Infinity Voice Lab v1.2

**Definition of completion:** offline deterministic *control-plane prototype*, not a live voice engine.

## Deliverables
- Pure immutable session lifecycle, explicit provider acknowledgement and uncertain-state review.
- Bounded ordered event queue with backpressure and replay/gap rejection.
- Metadata-only audio contract; no PCM, transcripts, keys, or extra fields persisted.
- Integrated simulated voice turns: input start/stop, output start/stop, turn count, queue consumption.
- No audio events accepted after termination starts.
- Independent GitHub Actions checks plus unchanged Stage 1 regression suites.

## Verification
Mark Stage 2 **100% for offline prototype scope** only if:
1. `Infinity Voice v1.2 Offline Session Engine` is green on the final commit.
2. All five Stage 1 GitHub Actions workflows are green on that same commit.
3. No provider or microphone integration, real keys, network calls or production deployment have been introduced.

## Explicit exclusions
Real microphone/audio processing, realtime network handshake, latency/jitter measurements, turn-taking quality with live speech, OpenAI Realtime billing and provider acknowledgement authenticity are **not implemented or validated**. These belong to future gated stages. Do not treat the offline session state machine as provider truth. Do not release real capacity from these simulations.

## Next stage
Design a transport boundary and local-only mock adapter, then review authentication, budgets, recording/consent and deployment risks before any external provider connection.
