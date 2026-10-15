# Infinity Voice v2.0 — Etapa 2 Audio Realtime-Ready (offline)

**Ámbito:** laboratorio offline. Este documento no autoriza micrófono, altavoz, WebRTC, SIP, telefonía, proveedor realtime, despliegue ni gasto.

## Objetivo

Preparar contratos y máquinas de estado que permitan evolucionar después hacia un media plane real sin confundir simulación con audio de producción.

## Componentes implementados

1. **Frame de audio sintético:** PCM16LE mono, 16/24/48 kHz, frames de 10/20/30 ms, `Uint8Array` con tamaño exacto, epoch, secuencia, timestamp y dirección.
2. **Jitter/reorder buffer acotado:** reordenamiento dentro de ventana explícita, emisión sólo contigua, rechazo de replay/duplicados y backpressure al alcanzar capacidad.
3. **Barge-in:** generaciones de salida; una interrupción invalida la cola de la generación anterior y obliga a iniciar una generación nueva.
4. **Reconnect policy:** desconexión explícita, `streamEpoch` incremental, resume sequence exacto y rechazo de frames de epochs anteriores.
5. **Regresión integrada:** frame bytes + jitter + backpressure + barge-in + reconexión se prueban sin I/O real.

## Propiedades de seguridad

- Ningún frame proviene de un dispositivo real.
- No existe captura o playback.
- No existe codec negotiation: el laboratorio acepta sólo PCM16LE definido por contrato.
- No existe silencio implícito para reparar gaps: los gaps fallan cerrado.
- No existe cola ilimitada: se aplica backpressure.
- Un barge-in elimina output pendiente de la generación anterior.
- Una reconexión crea un nuevo epoch; media del epoch previo se considera stale.
- No se almacenan grabaciones ni PII.

## Riesgos deliberadamente pendientes

- Permisos y captura real de micrófono.
- Playback real, echo cancellation y noise suppression.
- WebRTC/SIP/telefonía y negociación real de codecs.
- Jitter/latencia medidos en red real.
- Clock drift y sincronización real entre dispositivos/proveedor.
- VAD real y detección acústica de barge-in.
- Cifrado y privacidad del media plane.
- Retención/borrado de audio, consentimiento y cumplimiento normativo.

## Criterio de salida de Etapa 2

Sobre un mismo HEAD de `lab/realtime-v1-1-candidate` deben estar verdes:

1. Contrato de bytes de audio sintético.
2. Jitter/reorder/backpressure.
3. Barge-in y generations.
4. Reconnect/epoch/gap policy.
5. Regresión integrada de Etapa 2.
6. `Infinity Voice v2.0 Design Only Gate`.

Cumplir este criterio significa únicamente **Etapa 2 offline validada**. No constituye validación de audio real ni autorización de un piloto.
