# Infinity Voice v2.0 — roadmap verificable

**Alcance:** preparación técnica y simulaciones offline. No autoriza implementación en vivo, llamadas reales, despliegues, proveedores, credenciales reales ni gasto.

## Regla de progreso

v2.0 se divide en cinco etapas de igual peso (20% cada una). El porcentaje de una etapa sólo aumenta cuando un reto tiene implementación, pruebas automatizadas y evidencia verde en la rama `lab/realtime-v1-1-candidate`. El avance global es la suma ponderada de las etapas; no es una garantía de seguridad ni de preparación para producción.

## Etapa 1 — Arquitectura y contratos de integración

Objetivo: definir un límite de proveedor auditable, credenciales de corta duración y controles de autorización que fallen cerrado antes de cualquier conexión real.

1. **Contrato de proveedor simulado, ciclo de vida y evidencia de cierre** — VALIDADO.
2. **Credencial firmada offline, efímera, acotada a sesión/scope/TTL y con protección de replay** — IMPLEMENTADO; requiere Design Only Gate verde en el commit final de esta actualización para quedar VALIDADO.
3. **Revocación, binding de origen/contexto y límites de autorización** — PENDIENTE.
4. **Timeout/cancelación del proveedor y semántica de terminación verificable** — PENDIENTE.
5. **Threat model, criterios de salida y gate de regresión de Etapa 1** — PENDIENTE.

Progreso verificable antes del gate final de esta actualización: **20% de Etapa 1 / 4% global**. Si el reto 2 queda verde: **40% de Etapa 1 / 8% global**.

## Etapa 2 — Motor de audio preparado para tiempo real

Diseñar, todavía en simulación, contratos para frames/buffers de audio, formatos y reloj, backpressure, jitter, interrupciones/barge-in, descarte seguro, reconexión y errores. No usar micrófono, altavoz, WebRTC, SIP ni proveedor real sin autorización específica.

## Etapa 3 — Orquestación conversacional avanzada

Introducir una interfaz provider-agnostic para un futuro modelo de IA, inicialmente mock; estados conversacionales, herramientas con allowlist, material comercial verificado, transferencia humana, protección ante instrucciones adversariales y trazabilidad de fuentes. No consumir APIs de IA reales.

## Etapa 4 — Seguridad, costos y resiliencia

Controles de duración, presupuesto, concurrencia, rate limiting, kill switch, privacidad/consentimiento, minimización y redacción, observabilidad sin PII, idempotencia, recuperación ante fallos y escenarios de proveedor parcial.

## Etapa 5 — Validación integral y preparación de piloto

Pruebas end-to-end offline, escenarios adversariales y de carga simulada, runbooks, incident response, rollback, paquete go/no-go y diseño de un piloto aislado. Completar esta etapa no autoriza el piloto: cualquier prueba real requiere autorización adicional y límites escritos.

## Regla de seguridad permanente

Toda incertidumbre sobre identidad, sesión, autorización, evidencia de cierre, presupuesto o estado del proveedor debe resolver **fail closed**. Ningún mock receipt, token de laboratorio o resultado simulado puede tratarse como evidencia de un evento real.
