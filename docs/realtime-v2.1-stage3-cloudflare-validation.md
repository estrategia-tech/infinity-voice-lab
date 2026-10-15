# Infinity Voice v2.1 — Validación real del control plane de Etapa 3

**Fecha de evidencia:** 2026-10-14/15  
**Rama:** `lab/realtime-v1-1-candidate`  
**Commit validado:** `8f519bf81e5db42ff7e9d3d1610801c29eb125a9`  
**Workflow run:** `38680087963`  
**Job:** `deploy-disabled-lab`  
**Resultado:** SUCCESS

## Evidencia real obtenida

El control plane aislado de Infinity Voice v2.1 fue desplegado realmente en Cloudflare mediante las credenciales ya existentes del repositorio, sin cargar todavía secretos de OpenAI/Telnyx y sin originar ninguna llamada.

Worker desplegado:

- nombre: `infinity-voice-v21-stage3-lab`;
- URL: `https://infinity-voice-v21-stage3-lab.estrategia-a81.workers.dev`;
- versión de aplicación reportada por `/health`: `2.1.0-stage3-candidate`;
- Cloudflare Version ID del despliegue validado: `fecc12e0-f70e-44f4-ad28-6354585cab1b`.

El workflow comprobó en una sola ejecución:

1. checkout exclusivo de `lab/realtime-v1-1-candidate`;
2. intención explícita de despliegue fail-closed;
3. presencia de credenciales Cloudflare en GitHub Actions sin imprimir su contenido;
4. token Cloudflare activo mediante verificación real contra la API de Cloudflare;
5. `LIVE_ENABLED=false`;
6. `EMERGENCY_STOP=true`;
7. pruebas unitarias y de seguridad de Stage 3 en verde;
8. Wrangler dry-run exitoso;
9. despliegue real del Worker y Durable Object binding;
10. `/health` real accesible después del despliegue;
11. `live_enabled=false` confirmado desde el Worker desplegado;
12. `static_emergency_stop=true` confirmado desde el Worker desplegado;
13. `customer_traffic=false` confirmado desde el Worker desplegado.

El mismo commit terminó con 13 checks de GitHub completados sin fallos.

## Estado de seguridad después del despliegue

El despliegue es intencionalmente **inoperante para llamadas reales** hasta completar el preflight de proveedor:

- no existe autorización runtime para aceptar llamadas porque `LIVE_ENABLED=false`;
- el static emergency stop permanece activo;
- el dynamic emergency stop nace fail-closed;
- no se cargó `OPENAI_API_KEY`;
- no se cargó `OPENAI_WEBHOOK_SECRET`;
- no se cargó `INTERNAL_CALLER_ALLOWLIST`;
- no se cargó `LAB_ACCESS_TOKEN` para operar el kill switch;
- no se configuró Telnyx desde este despliegue;
- no se compró ningún DID desde este despliegue;
- no hubo SIP real;
- no hubo consumo de GPT-Live;
- no hubo llamada interna, prospecto, cliente ni tráfico comercial.

## Qué queda validado y qué no

### VALIDADO REAL

- credenciales de despliegue Cloudflare existentes y activas;
- Worker aislado de Stage 3 desplegable;
- Durable Object binding desplegable;
- endpoint de salud real accesible;
- comportamiento inicial fail-closed real;
- posibilidad de conservar control plane separado de `main`, Infinity Hub, Meta y WhatsApp.

### PROBADO EN CI, AÚN NO VALIDADO CONTRA OPENAI/TELNYX

- verificación de firma webhook;
- deduplicación de sesión;
- caller allowlist;
- aceptación/rechazo GPT-Live;
- control de emergency stop;
- preflight de evidencia de Telnyx/OpenAI.

### PENDIENTE DE ACTIVO REAL

- cuenta Telnyx utilizable;
- DID voice-capable;
- conexión FQDN SIP a OpenAI;
- TLS/SRTP configurados en Telnyx;
- Project ID de OpenAI como Translated Number;
- acceso real a `gpt-live-1` vía SIP;
- webhook OpenAI creado y signing secret colocado en Cloudflare;
- API key OpenAI colocada en Cloudflare;
- identidad interna explícitamente allowlisted;
- primer handshake SIP real;
- sideband/monitoring real;
- hangup verificable;
- medición y conciliación de costo.

## Impacto en progreso

Esta evidencia **no suma todavía el primer 4% de Etapa 3**, porque el roadmap exige que ese hito incluya los activos reales de proveedor/número/trunk. Evitar sumar porcentaje aquí impide confundir un control plane desplegado con una integración de telefonía ya operativa.

**Progreso global permanece en 40%.**
