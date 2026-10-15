# Infinity Voice v2.1 — Architecture Decision Record

**Estado:** aprobado técnicamente para preparación pre-live. No autoriza servicios reales.

## Decisión

Arquitectura recomendada para el primer piloto:

`Número de prueba / PSTN → Telnyx SIP Trunk → OpenAI GPT-Live gpt-live-1 (SIP directo) → sideband de control → Cloudflare Worker + Durable Object → políticas/herramientas allowlisted → logs mínimos sin audio`

## Por qué esta ruta

### 1. SIP directo como camino primario

OpenAI Live permite llamadas salientes mediante SIP y exige trunk con TLS signaling, Opus y SDES-SRTP. El proveedor intercambia el audio directamente con OpenAI; nuestra aplicación conserva control de sesión, reglas de negocio y observabilidad. Esto elimina un media bridge propio del camino crítico, reduce componentes, transcodificación y puntos de falla.

### 2. Telnyx como proveedor recomendado para el piloto

Se elige Telnyx como primera opción porque su documentación pública soporta SIP sobre TLS, SRTP y Opus de forma general, además de números de México y esquema pay-as-you-go. Para el requisito exacto de OpenAI, esta compatibilidad es más directa que Twilio Elastic SIP Trunking, donde Opus figura como Limited Availability y puede requerir habilitación comercial.

Twilio queda como **fallback A** por madurez, documentación y precios de México claramente publicados. Se debe reconsiderar si Telnyx no ofrece inventario/ruta adecuada en México, si el precio real resulta desfavorable o si aparece incompatibilidad de SDP/codec/seguridad en la prueba controlada.

### 3. GPT-Live `gpt-live-1`

Se elige GPT-Live para el primer piloto porque tiene una tarifa de sesión por minuto publicada y está diseñado para audio conversacional de baja latencia, telephony/SIP y sideband backend. La sesión debe usar `store=false` inicialmente. Herramientas y cualquier modelo backend adicional deben estar detrás de allowlist y presupuesto independiente.

### 4. Cloudflare como control plane, no media plane

El Worker de laboratorio existente es candidato natural para iniciar sesiones, aplicar admisión, consultar el kill switch y manejar eventos. Un Durable Object por sesión puede coordinar estado/atomicidad. El audio no debe atravesar Cloudflare en la arquitectura primaria.

Los WebSockets salientes de Cloudflare no hibernan, por lo que el sideband persistente puede generar duración facturable. Para el piloto pequeño es aceptable si se mide; si el costo/estabilidad no son adecuados, el sideband puede migrar a un runtime Node dedicado sin cambiar el contrato del dominio.

## Componentes y responsabilidades

- **Telnyx:** número, PSTN, SIP trunk, signaling/media cifrados, evidencia de estado de llamada del proveedor.
- **OpenAI GPT-Live:** conversación de voz, audio, sesión Live y eventos de sesión.
- **Control plane:** autorización, límites, configuración, tools, handoff, kill switch y conciliación.
- **Durable state:** presupuesto, concurrencia, idempotencia, revocación y estado de sesión.
- **Infinity Hub:** fuera del piloto inicial. Se integrará sólo después de validar llamadas internas y mediante contrato de herramientas separado.

## Invariantes

1. Ninguna API key o password SIP llega al navegador o repositorio.
2. `liveAuthorization=false` por defecto.
3. Sin presupuesto aprobado, no se crea una sesión real.
4. Sólo destinos internos allowlisted durante Etapa 3–4.
5. Sin cold calling ni prospectos en las primeras pruebas.
6. Sin grabación de audio por defecto y `store=false` en OpenAI durante piloto inicial.
7. Ningún cierre local libera capacidad si el proveedor real no confirma el estado requerido.
8. Cada llamada real debe tener ID de sesión, presupuesto, reloj máximo y ruta de cancelación.

## Criterios para cambiar la decisión

Cambiar Telnyx o SIP directo sólo si aparece evidencia medible de: incompatibilidad con TLS/Opus/SDES-SRTP; ausencia de números/rutas adecuadas para México; costo real materialmente superior; calidad/latencia insuficiente; o limitación operativa que haga necesario un media bridge.

## Pendientes que requieren intervención del propietario

- Autorizar alta/uso de cuenta Telnyx o elegir Twilio fallback.
- Autorizar presupuesto real distinto de cero.
- Autorizar compra/uso de un número de laboratorio.
- Autorizar cargar secretos en Cloudflare/OpenAI/Telnyx.
- Autorizar la primera llamada real y su número destino.
