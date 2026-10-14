# Infinity Voice Lab v1.1 — Realtime candidate (DESIGN ONLY)

Status: planning; NOT deployed; no calls, no OpenAI sessions activated.

## Goal
Validate natural Spanish (Mexico) real-time browser voice with OpenAI Realtime before purchasing telephony. Maintain a standalone lab, separate from Infinity Hub production.

## Architecture boundary
- Browser microphone and audio output ↔ OpenAI Realtime via short-lived ephemeral client credentials.
- Dedicated laboratory server endpoint mints ephemeral credentials after verifying a lab-specific authorization; the permanent OpenAI API key remains server-side.
- No permanent OpenAI key, Cloudflare secret, CRM credential or customer information in GitHub Pages, browser source, query strings or logs.
- A future SIP/telephone bridge is a separate phase and is NOT part of v1.1.
- Infinity Hub remains the owner of commercial state in future integration; v1.1 does not access it.

## Security / fail closed
1. AI sessions DISABLED by default. No endpoint can mint credentials until explicit lab enablement.
2. Origin allowlist and bearer authentication; do not mistake browser CORS for authentication.
3. Rate limits, maximum session length, concurrency limit and budget ceiling enforced server-side; reject if limits cannot be verified.
4. No secrets or customer data logged; minimize diagnostics; no persistent transcript in v1.1.
5. Disconnect must stop microphone, audio tracks, network session and client timers.
6. No outbound PSTN calls, no SIP provisioning, no deployment on merge, no changes to current v0.9 Worker.
7. Confirm exact OpenAI API capabilities, pricing and ephemeral-token flow against current official documentation before coding; avoid hard-coded assumptions.

## Acceptance tests
- Disabled-by-default endpoint denies session creation without consuming OpenAI credits.
- Unauthorized / expired / malformed credentials rejected.
- Disallowed Origin rejected, plus independent authentication validation.
- Sessions expire; user stop and network failure release microphone and audio resources.
- Maximum time and concurrency enforced even on abrupt disconnect.
- No credentials in browser bundle, logs or CI output.
- No production services, WhatsApp, Meta or Hub accessed.
- With explicit separate approval to enable lab: real audio conversation in es-MX, interruption handling, latency measurement, clear AI identification and manual termination.
- Document measured cost per minute and quality before evaluating a Mexican telephone provider.

## Rollout gates
A. Design and security review (current).
B. Implement code + automated tests on this branch, with AI disabled.
C. Verify CI, inspect diffs and obtain explicit approval for any isolated deployment.
D. Obtain explicit approval for metered Realtime session test; monitor spend.
E. Select low-cost PSTN/SIP provider only after browser audio meets criteria.

## Current known limitations
The v1.0 page uses browser SpeechRecognition/speechSynthesis and the v0.9 Worker uses text-based Responses API; these are not OpenAI Realtime voice. Existing v0.9 security workflows do not validate v1.1.
