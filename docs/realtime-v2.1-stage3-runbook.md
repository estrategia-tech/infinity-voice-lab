# Infinity Voice v2.1 — Runbook Etapa 3

**Última revisión de documentación pública:** 2026-10-14 (México)  
**Proveedor primario autorizado:** Telnyx  
**Presupuesto máximo acumulado autorizado:** USD 20  
**Alcance:** pruebas internas controladas; sin prospectos ni clientes.

## Decisión operativa para la primera prueba

La primera prueba real será **inbound-first**:

`teléfono interno allowlisted → DID Telnyx → Telnyx FQDN SIP (TLS + SRTP) → OpenAI GPT-Live → webhook/sideband del laboratorio`

La razón es de evidencia, no de preferencia: la guía vigente de Telnyx para GPT-Live documenta explícitamente la ruta inbound directa, mientras que la documentación vigente de OpenAI presenta la integración de Telnyx para experiencias outbound mediante Telnyx Voice API. Por eso el outbound directo queda detrás de un gate independiente hasta demostrar compatibilidad real. No se cambia Telnyx como proveedor primario.

Fuentes públicas revisadas:

- OpenAI Telephony and SIP: `https://developers.openai.com/api/docs/guides/voice-sip?voice-api=realtime`
- OpenAI GPT-Live partner integrations: `https://developers.openai.com/api/docs/guides/live-partner-integrations`
- Telnyx GPT-Live SIP guide: `https://developers.telnyx.com/docs/voice/sip-trunking/gpt-live-configuration-guide`
- Telnyx SIP trunking full docs: `https://developers.telnyx.com/public/llms/calling/sip-trunking-full.txt`

## Fase A — desplegar control plane bloqueado

Target aislado:

- Worker: `infinity-voice-v21-stage3-lab`
- Entry point: `realtime-v2.1-stage3-worker.mjs`
- Durable Object binding: `STAGE3_CONTROL`
- `LIVE_ENABLED=false`
- `EMERGENCY_STOP=true`

El workflow manual `Infinity Voice v2.1 Stage3 Fail-Closed Deploy` sólo puede desplegar este target y debe verificar después del despliegue que live sigue deshabilitado.

Este despliegue todavía no necesita colocar una llamada.

## Fase B — secretos

Cargar directamente en el secret manager de Cloudflare para el Worker de Etapa 3. Nunca pegarlos en GitHub, chat, screenshots o archivos:

1. `OPENAI_API_KEY` — clave server-side del mismo proyecto de OpenAI que recibirá el SIP.
2. `OPENAI_WEBHOOK_SECRET` — signing secret del webhook del proyecto OpenAI.
3. `INTERNAL_CALLER_ALLOWLIST` — lista E.164, separada por comas, exclusivamente de participantes internos autorizados.
4. `LAB_ACCESS_TOKEN` — token administrativo aleatorio para el kill switch.

No se requiere `TELNYX_API_KEY` para la ruta inbound directa inicial porque el Worker no llama a la API de Telnyx. Esto reduce superficie de secretos.

No reutilizar ni copiar secretos desde el repositorio. Si un secreto existente no puede trasladarse mediante un secret manager de forma segura, crear/rotar uno.

## Fase C — OpenAI

En el proyecto dedicado al laboratorio:

1. Confirmar que el proyecto tiene acceso a **GPT-Live SIP** y `gpt-live-1`.
2. Obtener el Project ID con prefijo `proj_`.
3. Crear/confirmar una API key server-side del mismo proyecto.
4. Crear webhook público apuntando exactamente a:
   `https://infinity-voice-v21-stage3-lab.estrategia-a81.workers.dev/webhooks/openai`
5. Suscribir `live.transport.incoming`.
6. Guardar su signing secret como `OPENAI_WEBHOOK_SECRET`.
7. No activar grabación ni almacenamiento de sesión desde Infinity Voice.

La integración no debe mezclar contratos Realtime y GPT-Live: la Etapa 3 usa `live.transport.incoming`, `data.session_id` y `/v1/live/sessions/{session_id}/...`.

## Fase D — Telnyx

1. Crear o verificar la cuenta Telnyx.
2. Completar exclusivamente la verificación requerida para adquirir el número de laboratorio.
3. No aceptar ningún fondeo, plan o compromiso que haga superar el límite acumulado autorizado de USD 20. Si el portal exige un pago inicial superior, **STOP** y pedir nueva autorización.
4. Adquirir un solo número voice-capable para laboratorio.
5. Crear Voice → SIP Trunking → SIP Connection de tipo **FQDN**.
6. FQDN: `sip.api.openai.com`.
7. Puerto: `5061`.
8. SIP transport: **TLS**.
9. Encrypted media: **SRTP Mandatory**.
10. Habilitar un codec compatible; preferir Opus y conservar PCMU/PCMA sólo como compatibilidad si el SDP lo requiere.
11. Asignar el número de laboratorio a esa conexión.
12. En Voice settings del número, colocar como **Translated Number** el Project ID completo de OpenAI, incluido `proj_`.
13. Antes de llamar, revisar que el número, FQDN, puerto, TLS, SRTP, codec y Project ID sean correctos.

Telnyx publica Pay As You Go con mínimo mensual de USD 0; los números y llamadas se cobran por uso y el precio exacto del DID de México debe validarse en el portal antes de comprar. Los números de México pueden requerir documentación de identidad/empresa y domicilio. Si cualquier cargo real llevara el acumulado por encima de USD 20, detener la operación.

## Fase E — armado del gate antes de la primera llamada

No iniciar la llamada hasta tener evidencia de todos estos puntos:

- cuenta Telnyx lista;
- DID voice-capable adquirido;
- FQDN connection correcta;
- TLS activo;
- SRTP Mandatory;
- codec compatible;
- DID asignado;
- Project ID traducido;
- GPT-Live SIP disponible;
- webhook creado y signing secret cargado;
- API key cargada en Worker;
- `INTERNAL_CALLER_ALLOWLIST` contiene exactamente al participante de prueba;
- Worker desplegado;
- kill switch funcional;
- gasto acumulado conocido;
- consentimiento explícito del participante interno.

Después, en una ventana de prueba controlada:

1. mantener una sola llamada concurrente;
2. duración objetivo máxima 300 segundos;
3. primero limpiar el **dynamic emergency stop** mediante endpoint administrativo autenticado;
4. sólo entonces desplegar/cambiar `LIVE_ENABLED=true` y `EMERGENCY_STOP=false` mediante un cambio auditable;
5. hacer una única llamada desde el teléfono allowlisted al DID Telnyx;
6. comprobar webhook firmado, aceptación única, audio bidireccional y cierre;
7. reactivar el emergency stop inmediatamente al terminar;
8. reconciliar costo real en OpenAI/Telnyx.

## STOP conditions

Detenerse sin reintento automático si ocurre cualquiera:

- el webhook no firma correctamente;
- llega un caller fuera de allowlist;
- se desconoce el estado del kill switch;
- el evento no usa `live.transport.incoming` + `data.session_id`;
- el proveedor devuelve estado ambiguo al aceptar/cerrar;
- falta SRTP o TLS;
- existe riesgo de doble aceptación por webhook duplicado;
- se desconoce el gasto acumulado;
- aparece un cargo que rebasa el presupuesto;
- la prueba alcanzaría prospectos o clientes;
- hay que tocar Infinity Hub, Meta o WhatsApp para continuar.

## Outbound

Outbound está autorizado únicamente dentro del alcance interno y presupuesto de Etapa 3, pero **no es la primera ruta**. Se habilitará después de demostrar la ruta inbound y después de validar la integración Telnyx/OpenAI recomendada por documentación vigente. Nunca reintentar automáticamente una creación outbound ambigua: cada creación puede originar una llamada adicional.
