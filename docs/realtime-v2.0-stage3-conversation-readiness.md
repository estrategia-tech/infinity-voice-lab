# Infinity Voice v2.0 — Etapa 3 Orquestación conversacional avanzada (offline)

**Ámbito:** laboratorio offline. No existe conexión con un modelo real, OpenAI, herramientas externas, CRM, WhatsApp, clientes ni gasto.

## Objetivo

Crear una frontera provider-agnostic para un futuro modelo de IA, tratando toda salida del modelo como datos no confiables y preservando las protecciones comerciales de Infinity Living.

## Componentes implementados

1. **Contrato de propuesta de modelo:** turnos, intent, draft reply, tool calls, claims estructurados, handoff y versión del mock model. Rechaza campos inesperados, tamaños no acotados y formas inválidas.
2. **Tool policy:** allowlist explícita para materiales verificados, recolección de preferencias y solicitud de revisión humana. Ninguna herramienta se ejecuta realmente.
3. **Material catalog:** sólo entrega datos marcados como verificados; material ausente o no verificado queda retenido.
4. **Commercial policy:** claims comerciales estructurados requieren fuente y estado de verificación. Plusvalía, rendimiento y fecha de entrega no pueden marcarse como garantizados.
5. **Conversation orchestrator:** valida el output del modelo, las herramientas, claims y handoff; produce únicamente un plan offline con `execute:false` y `publishable:false`.

## Propiedades de seguridad

- La salida del futuro modelo no se considera autoridad.
- Prompt-injection-like output no puede ampliar el allowlist de herramientas.
- Una herramienta desconocida se rechaza, incluso si el texto del modelo ordena ejecutarla.
- Material no verificado se retiene en lugar de completarse o inventarse.
- Handoff bloquea nuevos turnos automáticos, pero no contacta a una persona.
- Claims de plusvalía/rendimiento/entrega no pueden declararse garantizados.
- Los borradores del modelo no son publicables automáticamente en esta etapa.

## Riesgos deliberadamente pendientes

- No existe un LLM real ni autenticación de proveedor de IA.
- No existe grounding semántico de texto libre contra una base documental real.
- No existe tool execution real ni autorización de acciones externas.
- No existe memoria persistente del cliente.
- No se han implementado todavía límites globales de costo/concurrencia, kill switch, PII redaction u observabilidad operacional; corresponden a Etapa 4.

## Criterio de salida de Etapa 3

Sobre el mismo HEAD de `lab/realtime-v1-1-candidate` deben estar verdes:

1. Model proposal contract.
2. Tool allowlist + verified-material policy.
3. Commercial claim + handoff policy.
4. Conversation orchestrator.
5. Regresión integrada adversarial de Etapa 3.
6. `Infinity Voice v2.0 Design Only Gate`.

Completar este criterio significa únicamente **orquestación conversacional offline validada**. No autoriza consumir APIs de IA ni conectar sistemas reales.
