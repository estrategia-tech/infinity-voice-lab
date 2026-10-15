# Infinity Voice v2.1 — one-time Stage 3 fail-closed deployment intent

This file exists only to trigger the isolated Stage 3 laboratory deployment after the owner's explicit authorization.

AUTHORIZED_FAIL_CLOSED_DEPLOY=true
LIVE_ENABLED=false
EMERGENCY_STOP=true
MAX_AUTHORIZED_BUDGET_USD=20
INTERNAL_TESTS_ONLY=true

Verification retry: the first deployment itself succeeded, but the immediate workers.dev health request returned HTTP 404. This retry preserves identical fail-closed runtime settings and only adds a bounded propagation wait before declaring the health check failed.

The deployment must stop if the existing GitHub Cloudflare credentials are absent or inactive. It must not load OpenAI/Telnyx secrets, purchase any number, create any call, contact any prospect/client, or modify Infinity Hub, Meta, WhatsApp, or `main`.
