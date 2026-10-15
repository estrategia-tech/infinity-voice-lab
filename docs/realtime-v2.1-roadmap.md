# Infinity Voice v2.1 — roadmap de piloto real controlado

**Rama autorizada:** `lab/realtime-v1-1-candidate`

**Regla:** ningún porcentaje se gana por intención. Un hito suma 4% global únicamente cuando tiene artefacto/documento terminado, revisión o prueba verificable y, para Etapa 3–4, evidencia real del proveedor/entorno cuando corresponda. `100% v2.1` significará preparación para un piloto comercial limitado; no producción masiva.

## Etapa 1 — Arquitectura real y proveedores (20%)

1. Arquitectura objetivo de punta a punta — **VALIDADO**.
2. Comparación de proveedores de telefonía/voz — **VALIDADO**.
3. Modelo de IA y arquitectura conversacional — **VALIDADO**.
4. Modelo de costos por minuto/llamada/piloto — **VALIDADO**.
5. ADR de arquitectura recomendada y criterios de cambio — **VALIDADO**.

**Etapa 1: 20/20%.**

Decisión técnica actual: Telnyx + OpenAI GPT-Live (`gpt-live-1`) mediante SIP directo; Cloudflare Worker + Durable Object como control plane, sin media bridge propio en el camino primario. Para la primera prueba real la ruta se refinó a **inbound-first** porque Telnyx documenta específicamente esa integración directa con GPT-Live.

## Etapa 2 — Seguridad, costos y controles pre-live (20%)

1. Diseño de manejo de secretos server-side — **VALIDADO**.
2. Presupuesto, duración y límites de concurrencia con default de gasto real en cero — **VALIDADO**.
3. Kill switch y fail-closed admission gate — **VALIDADO**.
4. Política de privacidad/consentimiento/retención para el piloto — **VALIDADO**.
5. Gate automatizado de pre-live y checklist de intervención humana — **VALIDADO**.

**Etapa 2: 20/20%.**

“VALIDADO” en esta etapa significa que los controles pre-live están especificados y probados. La autorización posterior de Etapa 3 no convierte automáticamente esos controles en evidencia de proveedor real.

## Etapa 3 — Integración real en laboratorio (0/20%)

**Autorización del propietario: RECIBIDA.** Telnyx primario, presupuesto máximo inicial acumulado USD 20, pruebas internas controladas, configuración real y secrets permitidos; prospectos y clientes prohibidos.

1. Cuenta/proyecto de proveedor y número/trunk de laboratorio aprobados — **PENDIENTE DE ACTIVO REAL**.
2. OpenAI GPT-Live SIP disponible y credencial server-side almacenada como secret — **PENDIENTE DE EVIDENCIA REAL**.
3. Primer handshake SIP cifrado real, exclusivamente con identidad interna allowlisted — **PENDIENTE**.
4. Sideband/monitoring real, hangup verificable y kill switch probado — **PENDIENTE**.
5. Coste real medido y conciliado contra límites — **PENDIENTE**.

**Etapa 3: 0/20%.**

### Bootstrap técnico de Etapa 3 — PREPARADO

Sin sumar porcentaje de integración real, ya quedan preparados en la rama:

- registro formal de autorización y límites;
- preflight de evidencia real para inbound/outbound;
- verificación criptográfica del webhook OpenAI;
- parsing de caller E.164 y allowlist;
- Worker candidato de Stage 3 con fail-closed admission;
- Durable Object para claim/deduplicación y emergency stop dinámico;
- estado inicial `LIVE_ENABLED=false` + `EMERGENCY_STOP=true`;
- Wrangler config aislado `infinity-voice-v21-stage3-lab`;
- CI de bootstrap con pruebas y dry-run;
- workflow manual de despliegue fail-closed;
- runbook de Telnyx/OpenAI/Cloudflare sin secretos en Git.

La primera ruta real será inbound:

`teléfono interno allowlisted → DID Telnyx → FQDN SIP TLS/SRTP → OpenAI GPT-Live → control plane`.

El outbound queda detrás de evidencia adicional de compatibilidad y no se usa como primer handshake.

## Etapa 4 — Piloto interno controlado (0/20%)

1. Primera llamada interna autorizada.
2. Audio bidireccional estable y latencia medida.
3. Barge-in/interrupciones/cierre correctos.
4. Herramientas permitidas y escalamiento humano controlado.
5. Serie de pruebas internas con métricas y reporte.

## Etapa 5 — Preparación de piloto comercial (0/20%)

1. Guion/identidad de asistente y disclosure validados.
2. Material inmobiliario verificable conectado con controles de fuente.
3. Consentimiento, privacidad, REPEP y flujo de opt-out revisados para prospectos.
4. Dashboard/runbook/incident response/rollback operativos.
5. Go/No-Go formal para un piloto limitado con prospectos que hayan consentido contacto.

## Progreso v2.1

- Etapa 1: **20/20%**
- Etapa 2: **20/20%**
- Etapa 3: **0/20% real** — bootstrap técnico preparado; autorización recibida.
- Etapas 4–5: **0/40%**
- **Global verificado: 40%**

## Frontera actual

Ya no falta autorización de Etapa 3. Lo que falta para ganar el siguiente 4% es evidencia real de activos: cuenta Telnyx utilizable, DID voice-capable de laboratorio, conexión SIP configurada y proyecto OpenAI con GPT-Live SIP. La compra/configuración debe mantenerse dentro de USD 20 acumulados.

El número interno que participará en la prueba debe ser confirmado explícitamente por el propietario y cargado directamente como secret `INTERNAL_CALLER_ALLOWLIST`; nunca debe inferirse ni escribirse en el repositorio.

Siguen fuera de alcance: prospectos, clientes, cold calling, Infinity Hub, Meta, WhatsApp, `main`, producción masiva y cualquier gasto superior a USD 20 sin nueva autorización.
