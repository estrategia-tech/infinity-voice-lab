# Infinity Voice v2.1 — Architecture Decision Record

**Estado:** Etapa 3 autorizada por el propietario para laboratorio real, máximo acumulado USD 20, exclusivamente pruebas internas controladas. No autoriza prospectos, clientes ni producción masiva.

## Decisión actual

Arquitectura del primer handshake real:

`Teléfono interno allowlisted → DID Telnyx → Telnyx FQDN SIP → OpenAI GPT-Live gpt-live-1 → webhook/sideband de control → Cloudflare Worker + Durable Object → políticas/herramientas allowlisted → logs mínimos sin audio`

El camino de medios continúa siendo **SIP directo**: el audio viaja Telnyx ↔ OpenAI y no atraviesa Infinity Voice. Cloudflare funciona como control plane.

## Refinamiento de Etapa 3: inbound-first

La selección de Telnyx se mantiene. Lo que cambia es el orden de validación.

La documentación vigente de Telnyx tiene una guía específica y verificable para **inbound directo a GPT-Live** mediante una conexión FQDN a `sip.api.openai.com:5061`, señalización TLS, SRTP Mandatory, número asignado y Project ID de OpenAI como Translated Number. Esa será la primera ruta real.

La documentación vigente de OpenAI también lista Telnyx como partner para experiencias outbound, pero remite a una integración mantenida por el partner. Por seguridad, el outbound no se usa como primer handshake y permanece detrás de evidencia específica de compatibilidad/configuración.

Esto evita asumir que una ruta SIP outbound genérica funcionará sólo porque ambos extremos soporten SIP.

## Componentes

### Telnyx

Para la primera prueba:

- un único DID voice-capable de laboratorio;
- SIP Connection tipo FQDN;
- FQDN `sip.api.openai.com`;
- puerto `5061`;
- TLS;
- SRTP Mandatory;
- codec compatible (Opus preferido; PCMU/PCMA sólo si la negociación lo requiere);
- número asignado a la conexión;
- Translated Number igual al Project ID de OpenAI con prefijo `proj_`.

### OpenAI GPT-Live

- proyecto dedicado al laboratorio;
- acceso GPT-Live SIP confirmado;
- `gpt-live-1`;
- webhook `live.transport.incoming`;
- usar `data.session_id` sin sustituirlo por IDs SIP/carrier;
- aceptar/rechazar mediante `/v1/live/sessions/{session_id}/...`;
- sideband mediante `/v1/live/sessions/{session_id}/attach` cuando llegue la fase de monitoreo;
- API key y webhook signing secret sólo server-side.

### Cloudflare

Worker aislado: `infinity-voice-v21-stage3-lab`.

Responsabilidades:

- verificar firma y frescura del webhook antes de parsear/actuar;
- deduplicar por sesión mediante Durable Object;
- exigir caller interno allowlisted;
- fail closed ante pérdida de estado;
- static + dynamic emergency stop;
- aceptar/rechazar la sesión sin exponer secretos;
- más adelante, sideband, métricas y conciliación de cierre.

Cloudflare no es media bridge en la ruta primaria.

## Secretos mínimos de la primera ruta

En Cloudflare secret manager, nunca en Git:

- `OPENAI_API_KEY`;
- `OPENAI_WEBHOOK_SECRET`;
- `INTERNAL_CALLER_ALLOWLIST`;
- `LAB_ACCESS_TOKEN`.

No se necesita una API key Telnyx dentro del Worker para el primer inbound directo, porque la configuración inicial de Telnyx se realiza en el provider y el media path es SIP directo. Reducir secretos es preferible a añadir credenciales que todavía no tienen una función runtime.

## Invariantes

1. Ninguna API key, signing secret, token administrativo o contraseña SIP llega al navegador o repositorio.
2. El despliegue inicial conserva `LIVE_ENABLED=false`.
3. El despliegue inicial conserva `EMERGENCY_STOP=true`.
4. El dynamic emergency stop nace activo por ausencia de estado explícito.
5. Ninguna sesión se acepta si el caller no pertenece a la allowlist interna.
6. Sin presupuesto conocido no se ejecuta la prueba.
7. Máximo acumulado autorizado para Etapa 3: USD 20.
8. Máximo una llamada concurrente y objetivo máximo 300 segundos por prueba.
9. Sin prospectos, clientes, cold calling ni tráfico comercial.
10. Sin grabación de audio por defecto.
11. Webhooks duplicados no pueden provocar una segunda aceptación.
12. El cierre local no se reporta como cierre real sin evidencia del proveedor.
13. Infinity Hub, Meta y WhatsApp quedan fuera de Etapa 3.
14. `main` queda fuera de Etapa 3; sólo se trabaja en `lab/realtime-v1-1-candidate`.

## Outbound posterior

Outbound puede evaluarse dentro de la autorización de Etapa 3 sólo para destinos internos allowlisted y dentro del presupuesto. Requiere un gate adicional con:

- acceso outbound SIP de OpenAI confirmado;
- configuración Telnyx outbound adecuada;
- caller number válido;
- secrets de trunk protegidos;
- compatibilidad real validada;
- idempotencia estricta: una creación ambigua no se reintenta automáticamente porque podría generar una segunda llamada.

## Criterios para cambiar Telnyx o SIP directo

Cambiar la decisión sólo con evidencia medible de incompatibilidad TLS/SRTP/codec, falta de inventario/ruta adecuada, costo real incompatible con el piloto, calidad/latencia insuficiente o una necesidad demostrada de inspeccionar/transformar audio con media bridge.

## Estado de autorización

La autorización de Etapa 3 ya existe y está registrada en `docs/realtime-v2.1-stage3-authorization.md`. La siguiente frontera no es una nueva autorización conceptual: es obtener/configurar los activos reales del proveedor y un número interno de prueba sin exceder el presupuesto.
