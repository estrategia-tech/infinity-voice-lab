# Infinity Voice v2.0 — roadmap verificable

**Alcance:** preparación técnica y simulaciones offline. No autoriza implementación en vivo, llamadas reales, despliegues, proveedores, credenciales reales, telefonía, tráfico de clientes ni gasto.

## Regla de progreso

v2.0 se divide en cinco etapas de igual peso (20% cada una). Una etapa sólo se considera completada cuando sus componentes están implementados, sus pruebas automatizadas pasan y existe evidencia CI verde en `lab/realtime-v1-1-candidate`. El 100% descrito aquí significa **100% de la preparación offline definida para v2.0**, no autorización para un piloto o para producción.

## Etapa 1 — Arquitectura y contratos de integración — VALIDADA OFFLINE (100%)

- Contrato de proveedor simulado y ciclo de vida.
- Credencial Ed25519 efímera de laboratorio con sesión, scope, TTL y replay protection.
- Binding de contexto/origen, scopes autorizados y revocación.
- Supervisor de proveedor con timeout/cancelación y terminación fail-closed.
- Threat model y regresión integral de la etapa.

## Etapa 2 — Motor de audio preparado para tiempo real — VALIDADA OFFLINE (100%)

- Contratos de frames de audio sintético y formatos controlados.
- Buffers acotados y backpressure.
- Control de turnos e interrupciones/barge-in simulado.
- Stream con secuencia/epoch y rechazo de gaps o replay.
- Regresión integral de audio sin micrófono, WebRTC, SIP ni proveedor real.

## Etapa 3 — Orquestación conversacional avanzada — VALIDADA OFFLINE (100%)

- Contrato provider-agnostic para propuestas de un futuro modelo.
- Herramientas bajo allowlist y `execute:false`.
- Política comercial con fuentes verificadas y rechazo de garantías no sustentadas.
- Material no verificado retenido para revisión.
- Handoff humano como decisión offline, sin contactar a nadie.
- Regresión conversacional y adversarial.

## Etapa 4 — Seguridad, costos y resiliencia — VALIDADA OFFLINE (100%)

- Límites de duración y presupuesto por sesión.
- Concurrencia global, rate limit por actor y emergency stop.
- Privacidad/minimización con consentimiento simulado, redacción y auditoría acotada.
- Idempotencia, reintentos limitados, backoff y revisión manual al agotar intentos.
- Evidencia explícita de cierre simulado antes de liberar capacidad.
- Regresión integrada de seguridad y resiliencia.

## Etapa 5 — Validación integral y preparación del piloto — VALIDADA OFFLINE (100%)

- Aceptación end-to-end de las etapas 1–4 en una sola ruta de laboratorio.
- Escenarios adversariales y carga determinista de 100 sesiones sintéticas sin fuga de slots.
- Gate estático que bloquea red, secretos y conexiones accidentales en módulos runtime v2.0.
- Pilot-readiness gate que puede declarar únicamente `offlineReadiness`; mantiene siempre `liveAuthorization=false` y gasto autorizado `0`.
- Runbook conceptual de rollback, respuesta a incidentes y criterios GO/NO-GO para una futura prueba aislada.

## Evidencia de cierre

El checkpoint de implementación `df47952504e61c3343d0431b673ff2f5a43b0e52` ejecutó los 10 workflows/checks configurados para el candidato y todos terminaron correctamente. Incluye el `Infinity Voice v2.0 Design Only Gate` con la aceptación final de v2.0 y los workflows heredados de v1.x, preservando la compatibilidad del laboratorio previo.

**Progreso v2.0 offline: Etapa 1 100% · Etapa 2 100% · Etapa 3 100% · Etapa 4 100% · Etapa 5 100% · Global 100%.**

## Lo que 100% NO significa

No significa `production ready`, `live ready` ni autorización de un piloto. Siguen requiriendo autorización separada y nueva evidencia: selección del proveedor real, infraestructura aislada, almacenamiento de secretos, autenticación server-side real, media plane real, presupuesto máximo, controles de costos efectivos, privacidad/consentimiento aplicables, observabilidad, kill switch real, identidad/números de prueba y límites escritos de la prueba.

## Regla de seguridad permanente

Toda incertidumbre sobre identidad, sesión, autorización, evidencia de cierre, presupuesto, privacidad o estado del proveedor debe resolver **fail closed**. Ningún mock receipt, token de laboratorio, consentimiento simulado o resultado offline puede tratarse como evidencia de un evento real.
