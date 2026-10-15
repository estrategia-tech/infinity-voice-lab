# Infinity Voice v2.1 — Stage 3 fail-closed deployment intent

This file triggers an isolated Stage 3 laboratory deployment under the owner's explicit authorization.

AUTHORIZED_FAIL_CLOSED_DEPLOY=true
LIVE_ENABLED=false
EMERGENCY_STOP=true
MAX_AUTHORIZED_BUDGET_USD=20
INTERNAL_TESTS_ONLY=true

Purpose of this deployment: publish the tested `/readiness` endpoint so configuration presence can be validated without exposing secret values and without making a phone call.

The deployment must preserve the existing Cloudflare Secret Manager values without printing, exporting, rotating, replacing, or committing them. It must remain fail-closed and must not purchase a number, originate or accept a real call, contact any prospect/client, or modify Infinity Hub, Meta, WhatsApp, or `main`.
