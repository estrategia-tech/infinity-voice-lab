# Infinity Voice Lab v1.5 — offline candidate validation

## Scope
Candidate branch only: lab/realtime-v1-1-candidate. No production deployment or live services.

## End-to-end acceptance
1. Local mock session and mock transport reach active state.
2. Deterministic dialogue requests verified material; unverified material is withheld.
3. Human handoff is only a decision; no real notification or CRM action.
4. Connection drop blocks dialogue; reconnect resumes; duplicate turns denied.
5. Prompt-injection-like string cannot cause external action.
6. Mock capability expires and cross-session frame is denied.
7. Retry exhaustion requests manual review; does not confirm provider hangup.

## Completion gate
All nine workflows green on the **same final commit**: five v1.1 safety/local tests, v1.2 engine, v1.3 transport, v1.4 conversation brain, and v1.5 acceptance. A green offline gate does not authorize production.

## Remaining work beyond lab
Actual voice assistant requires separately approved design, real provider authentication, encrypted transport, real speech I/O, cost and abuse controls, privacy/data handling, operational monitoring, and explicit live pilot authorization.
