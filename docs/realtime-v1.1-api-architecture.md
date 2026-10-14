# Infinity Voice v1.1 — Realtime API architecture decision (2026-10-14)

Official docs consulted:
- https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime
- https://developers.openai.com/api/docs/guides/voice-server-controls

## Recommendation: unified WebRTC (candidate, not enabled)
The browser generates an SDP offer and sends it to our authenticated application server. The server validates the caller, reserves quota and — ONLY AFTER FUTURE APPROVAL — posts multipart `sdp` + `session` to `POST https://api.openai.com/v1/realtime/calls` using the server-held API key, returning the SDP answer. This avoids distributing ephemeral credentials to the browser. Current official example uses model `gpt-realtime-2.1` and voice `marin`; validate model availability and pricing before activation.

Alternative documented method: server creates a short-lived secret via `POST /v1/realtime/client_secrets`, then browser posts SDP directly to `/v1/realtime/calls`. Current browser prototype follows this alternative but uses a legacy expected JSON shape; it is **not compatible as written** with the current documented example and remains hard-disabled.

## Important security and budget findings
- A Durable Object reservation is admission control, not a provider-side spending ceiling.
- Browser `RTCPeerConnection.close()` is not verified server-side termination.
- Realtime WebRTC calls may provide a call ID through the SDP response `Location` header. Official server-controls docs describe attaching a server WebSocket via `wss://api.openai.com/v1/realtime?call_id=...`; lifecycle semantics require an end-to-end test.
- The official server-side controls page also documents GPT-Live `session.close` / `session.closed`, which is **not proof** that the same events work for Realtime calls. Do not reuse this mechanism without verifying its API family.
- No claim of a hard USD cap can be made solely from token budgets, browser timers or reservation expiry.
- Prefer an application server that maintains authoritative control of media/session termination; evaluate a provider-backed kill mechanism and cost controls before allowing paid use.

## Next implementation gates
1. Build unified SDP request validator and isolated mock adapter, never contacting OpenAI.
2. Integrate auth + reservation + mock adapter with rollback on errors.
3. Validate safe shutdown with documented Realtime protocol and a bounded test approved by the user.
4. Review current API price and spending controls and establish an explicitly accepted exposure limit.
5. Only then enable browser and deploy to a separate laboratory Worker, with explicit approval.

All production services, `main`, Cloudflare and OpenAI remain untouched.
