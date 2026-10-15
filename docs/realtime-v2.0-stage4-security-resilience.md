# Infinity Voice v2.0 — Etapa 4 Seguridad, costos y resiliencia (offline)

**Ámbito:** laboratorio determinista y offline. No hay facturación real, almacenamiento externo, proveedor de voz, OpenAI, red, Cloudflare, Hub, Meta, WhatsApp, telefonía ni clientes reales.

## Objetivo

Impedir que una futura sesión pueda consumir recursos sin límites, iniciarse durante un apagado de emergencia, registrar PII sin minimización o convertir fallos parciales en estados falsamente exitosos.

## Componentes implementados

1. **Session guard:** duración máxima y presupuesto en unidades enteras de laboratorio. Bloquea expiración, sobreconsumo y continuación después del agotamiento.
2. **Runtime guard:** límite global de concurrencia, rate limit por actor, rechazo de sesiones duplicadas y emergency stop para nuevas admisiones.
3. **Privacy guard:** autorización previa de sesión, modo de consentimiento simulado cuando se requiere, redacción determinista de correo/teléfono y auditoría acotada por retención y número de eventos.
4. **Resilience contract:** claves de idempotencia, colisiones fail-closed, reintentos limitados con backoff determinista, agotamiento hacia revisión manual y evidencia explícita para cierre simulado.
5. **Regresión integrada:** una sesión sólo progresa si pasan los límites de runtime, presupuesto, privacidad y evidencia de cierre; rutas adversariales fallan cerrado.

## Límites deliberados

- `simulated_consent` no constituye consentimiento legal ni prueba de cumplimiento regulatorio.
- Las unidades de presupuesto no representan moneda ni cobran servicios.
- El emergency stop sólo es estado en memoria dentro de pruebas; no controla infraestructura real.
- La redacción implementada cubre patrones básicos de correo y teléfono para validar el contrato, no sustituye un sistema completo de DLP/PII detection.
- La evidencia `mock-provider-close-confirmed` es exclusivamente simulada y jamás debe tratarse como prueba de cierre de un proveedor real.
- No existe almacenamiento distribuido ni locking entre procesos; antes de un piloto real se requiere diseño de estado compartido/atómico.

## Criterio de salida de Etapa 4

Sobre el mismo HEAD de `lab/realtime-v1-1-candidate` deben estar verdes:

1. Session duration/budget guard.
2. Runtime concurrency/rate/emergency-stop guard.
3. Privacy/minimization/audit guard.
4. Idempotency/retry/recovery contract.
5. Regresión integrada de Etapa 4.
6. `Infinity Voice v2.0 Design Only Gate`.
7. Los workflows heredados de v1.x deben continuar verdes en ese mismo HEAD para confirmar que no se rompió el candidato offline previo.

Cumplir estos puntos significa **Etapa 4 validada exclusivamente en laboratorio offline**. No autoriza proveedores reales, claves, llamadas, despliegue ni gasto.
