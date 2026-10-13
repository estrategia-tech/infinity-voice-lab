# Infinity Voice Lab v0.6.1 — candidate, NO DESPLEGAR

- This candidate adds a **server-side 180-second lease** using Cloudflare Durable Objects, with one active lab session globally, explicit end, 10 starts/hour and 30 requests/minute.
- **No OpenAI integration**. `/session`, `/sessions`, `/openai`, `/realtime` remain blocked. The lease is a test record, **not** a Realtime session or access token.
- Protected `/lab/start` (POST), `/lab/status` (GET), `/lab/end` (POST) use `Authorization: Bearer <LAB_ACCESS_TOKEN>`; **never place this secret in the GitHub Pages frontend**.
- Requires a separate Cloudflare Worker deployment, a Durable Object binding and migration, and a Cloudflare plan that supports Durable Objects. `wrangler.lab.jsonc` deliberately names a **separate candidate Worker**, not the current v0.5.1.
- Tests mock storage and do not constitute live Cloudflare deployment validation; storage concurrency, pricing, and deployment compatibility must be verified in a separate lab before any rollout.
- **Security boundary:** a 180-second lease does not automatically terminate a future OpenAI Realtime call. Before enabling audio, implement server-side session lifecycle and enforced disconnect; ensure any ephemeral client credential lifetime and Realtime session duration are enforced independently.
- The LAB_ACCESS_TOKEN is operator-only. Future browser access requires separate identity, short-lived scoped credentials and server-side verification. No CORS preflight is enabled yet.

## Validate locally
`node --check worker-v0.6.1-candidate.mjs && node --test test-v0.6.1.mjs`

## GitHub Actions
Copy `.github/workflows/voice-lab-v061.yml` into the existing lab branch. Do not merge to `main` or deploy to the existing Worker.
