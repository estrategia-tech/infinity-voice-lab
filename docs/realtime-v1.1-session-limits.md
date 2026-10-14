# Infinity Voice v1.1 — session controls candidate
Status: NOT DEPLOYED. OpenAI session minting remains disabled.

The isolated Durable Object ledger reserves at most 1 concurrent session, 3 reservations per UTC day, and 120 seconds per reservation. Its internal endpoint must never be routed publicly.

**Critical limitations:** reservation expiry does not terminate an OpenAI Realtime connection; a browser timeout is not sufficient. These controls are NOT a guaranteed monetary spending ceiling. Before enabling sessions, implement server-side revocation/disconnect, server-side metering and a separately enforced spend ceiling, trusted internal authentication, and abuse-resistant quota policy. Reconcile abandoned reservations and test failure behavior. No real customer data.

Never expose a public Durable Object stub or publish the internal reserve endpoint. The existing fail-closed broker remains unchanged.
