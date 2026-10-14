# Infinity Voice v1.1 — security and release gates

Status: candidate branch only. **No paid OpenAI sessions enabled or deployed.**

## Implemented and tested
- Local Durable Object reservation ledger: concurrency 1, 3 reservations/UTC day, 120-second reservation expiry.
- Fail-closed public broker: `POST /api/realtime/session` returns 403 regardless of environment switches.
- Internal admission coordinator (not connected to the public broker).
- Independent origin + bearer token guard, currently a module and not connected to the browser.
- CI tests, including real local Wrangler Durable Object persistence and parallel admission.

## Blocking gaps before any live session
1. Confirm current OpenAI Realtime WebRTC ephemeral-session protocol, exact supported model and pricing in official documentation.
2. Build secure token minting behind lab authentication. Never put a permanent API key in browser/GitHub.
3. Wire the guard and ledger into the broker, preserving default-deny.
4. Implement server-side enforceable paid-session termination and cost ceiling. Reservation expiry is **not** a spending cap.
5. Protect public route with server-side authorization and abuse-resistant limits. Do not expose internal DO endpoints.
6. Run local end-to-end tests, code review and secrets scan.
7. Obtain explicit approval before any Cloudflare deployment, AI enablement, API spending or telephony.

## Important
A GitHub Pages browser UI is on a different origin than a Cloudflare Worker. Its future requests require deliberate, restricted CORS and a safe way to enter a short-lived lab credential. Do not expose `LAB_ACCESS_TOKEN` in source. Current v1.1 browser prototype cannot connect to the new broker as written (relative URL); integration is pending.

## Separation
No modifications to Infinity Hub, Meta, WhatsApp, telephony or production Cloudflare Worker. No `main` merge.
