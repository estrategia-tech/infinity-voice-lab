# Infinity Voice v2.0 — Etapa 5 Validación integral y preparación de piloto

**Ámbito:** exclusivamente laboratorio offline sobre `lab/realtime-v1-1-candidate`. Este documento no autoriza despliegue, proveedor real, credenciales, telefonía, tráfico de clientes ni gasto.

## Objetivo

Cerrar v2.0 con evidencia reproducible de que las capas de arquitectura, audio sintético, conversación, seguridad/costos y resiliencia pueden coexistir sin romper sus invariantes fail-closed. La salida de esta etapa es un paquete de **preparación offline**, no una aprobación de piloto real.

## Retos de Etapa 5

1. **Aceptación end-to-end offline:** credencial criptográfica efímera, ciclo de proveedor mock, admisión de runtime, presupuesto, privacidad, frame sintético, orquestación, cierre con evidencia mock y liberación explícita.
2. **Adversarial + carga simulada:** secuencias de audio inválidas, tools no permitidas, garantías comerciales indebidas, sobrepresupuesto, falta de consentimiento simulado, emergency stop y evidencia de cierre falsificada; además, 100 sesiones secuenciales sintéticas sin fuga de slots.
3. **Gate de preparación de piloto:** sólo puede declarar `offlineReadiness`; incluso con toda la evidencia completa mantiene `liveAuthorization=false`, gasto autorizado `0` y todos los permisos reales en `false`.
4. **Boundary estático offline:** los módulos runtime v2.0 no pueden introducir `fetch`, WebSocket, variables de entorno, módulos de red/proceso peligrosos ni patrones de secretos de proveedores.
5. **Gate final del mismo commit:** v2.0 Design Only Gate y todos los workflows heredados v1.x deben quedar verdes sobre el mismo HEAD antes de declarar completadas las cinco etapas offline.

## Go / No-Go para el paquete offline

### GO offline

Sólo si en el mismo commit:

- etapas 1–4 mantienen sus regresiones verdes;
- aceptación Stage 5 está verde;
- prueba adversarial/carga está verde;
- boundary offline está verde;
- pilot-readiness gate está verde;
- workflows heredados v1.x continúan verdes;
- no existe ninguna conexión, clave, llamada o gasto real introducido por v2.0.

### NO-GO offline

Cualquier fallo de CI, prueba omitida, evidencia en commits diferentes, regresión de v1.x, dependencia de red inesperada, fuga de secreto, liberación de capacidad sin evidencia, capacidad de auto-publicar/ejecutar o una ruta que permita superar presupuesto/privacidad/emergency stop.

## Diseño de rollback para un futuro piloto

Este diseño es preparatorio; no ejecuta rollback alguno.

1. Mantener el piloto futuro aislado de `main` y de producción.
2. Tener un artefacto/commit conocido y validado antes de cualquier prueba real.
3. Ante incidente, la primera acción lógica debe ser bloquear nuevas admisiones mediante un kill switch real diseñado para la infraestructura elegida.
4. Detener nuevas sesiones antes de intentar recuperar sesiones parciales.
5. No liberar capacidad ni marcar una sesión cerrada sin evidencia del proveedor real.
6. Invalidar/revocar credenciales de corto plazo según el mecanismo real que se apruebe.
7. Preservar evidencia mínima necesaria para análisis, aplicando minimización y política de retención.
8. Volver al último artefacto aprobado únicamente mediante un procedimiento separado, probado y autorizado.

## Diseño de respuesta a incidentes

Categorías mínimas para un piloto futuro:

- **Seguridad:** sospecha de credencial expuesta, bypass de autorización o tráfico no esperado → bloquear admisión y revocar acceso.
- **Costo:** consumo o concurrencia por encima del límite autorizado → bloquear nuevas sesiones y escalar revisión humana.
- **Privacidad:** PII inesperada en logs/telemetría → detener persistencia afectada, limitar acceso y activar procedimiento de evaluación/eliminación aplicable.
- **Proveedor:** timeouts, cierre ambiguo o fallo parcial → no confirmar cierre ni liberar capacidad hasta evidencia real; agotar reintentos limitados y pasar a revisión manual.
- **Comercial:** material no verificado o promesa no sustentada → retener respuesta y transferir a revisión humana; nunca publicar automáticamente.

## Bloqueos que requieren autorización separada

Antes de una prueba real siguen bloqueados, aunque Etapa 5 quede verde:

- selección y contratación de proveedor realtime/voz;
- definición de presupuesto máximo real;
- almacenamiento seguro de secretos y emisión server-side;
- infraestructura compartida/atómica para concurrencia y revocación;
- consentimiento/aviso de privacidad revisado para el caso de uso y jurisdicción;
- observabilidad, alertas y kill switch reales;
- identidad de prueba y números/endpoint autorizados;
- entorno aislado no productivo;
- revisión de dependencias y arquitectura de red real;
- autorización escrita del alcance, duración, usuarios de prueba y gasto máximo.

## Significado de 100%

Si el gate final queda verde, `100% v2.0` significa: **las cinco etapas de preparación offline definidas en este laboratorio están implementadas, probadas y validadas sobre un mismo commit**.

No significa “production ready”, “live ready”, “seguro para clientes reales” ni autorización para conectar OpenAI, telefonía, Cloudflare, Infinity Hub, Meta, WhatsApp o cualquier proveedor con costo.
