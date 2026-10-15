# Infinity Voice v2.1 — comparación de proveedores de voz

**Fecha de revisión:** 2026-10-14/15. Precios y requisitos pueden cambiar. Este documento no constituye contratación ni autorización de gasto.

## Requisito técnico de referencia

Para el camino SIP directo con OpenAI GPT-Live, el trunk debe soportar TLS signaling, Opus y SDES-SRTP. Las credenciales SIP permanecen server-side.

## Opción A — Telnyx (RECOMENDADA PARA PILOTO)

Fortalezas observadas en documentación pública:

- SIP sobre TLS y SRTP configurables.
- Opus aparece entre codecs soportados del servicio SIP.
- Números de México disponibles sujetos a verificación documental.
- Voice API y SIP Trunking pay-as-you-go; sin cuota mínima en el plan base.
- Media streaming bidireccional soporta Opus si en el futuro se necesita un bridge alternativo.

Riesgos/pendientes:

- La tarifa exacta a destinos de México debe consultarse con el precio efectivo del destino/cuenta antes del piloto; las páginas públicas generales publican tarifas “from”.
- Inventario y requisitos de DID mexicano deben verificarse en la cuenta real.
- Debemos validar interoperabilidad real de SDP, Opus, TLS y SDES-SRTP con OpenAI antes de ampliar pruebas.

## Opción B — Twilio (FALLBACK A)

Fortalezas:

- Excelente documentación y madurez operativa.
- Tarifas de México publicadas: llamadas locales salientes y móviles, números locales/móviles y Media Streams.
- SIP seguro soporta TLS y SDES-SRTP.
- Requisitos regulatorios de números mexicanos bien documentados.

Riesgo principal para el diseño SIP directo:

- Elastic SIP Trunking documenta PCMU/PCMA como codecs GA y Opus como Limited Availability. Como OpenAI exige Opus para outbound SIP Live, esta dependencia puede requerir habilitación comercial y agrega fricción al primer piloto.

## Opción C — media bridge propio

Ejemplos: Twilio/Telnyx media stream → aplicación → OpenAI WebRTC/WebSocket.

Ventajas:

- Máximo control sobre audio y traducción de eventos.
- Evita depender de compatibilidad SIP directa específica.

Desventajas:

- Más latencia, más estados distribuidos, más riesgo de desincronización, backpressure, transcoding y fugas de sesiones.
- La aplicación entra al camino de audio y aumenta superficie de privacidad/observabilidad.
- Requiere más infraestructura y monitoreo antes de un piloto pequeño.

**Decisión:** no usar media bridge propio como ruta primaria de v2.1. Mantenerlo como fallback técnico si SIP directo falla de forma demostrable.

## Matriz de decisión

| Criterio | Telnyx | Twilio | Bridge propio |
|---|---|---|---|
| TLS + SRTP | Sí documentado | Sí documentado | Depende del proveedor |
| Opus SIP | Sí documentado | Limited Availability | Se puede adaptar en bridge |
| México | Números disponibles; precio exacto por validar | Precios y requisitos publicados | Depende del carrier |
| Complejidad | Baja-media | Media por habilitación Opus | Alta |
| Camino de audio propio | No | No con SIP directo | Sí |
| Recomendación v2.1 | **Primaria** | **Fallback A** | **Fallback B** |

## Fuentes técnicas consultadas

- OpenAI: Telephony and SIP / Create Live session.
- Telnyx: SIP INFO, TLS and SRTP, Mexico DID requirements, Voice/SIP pricing.
- Twilio: Elastic SIP Trunking codecs, Secure Trunking, Mexico Voice pricing y regulatory guidelines.

La selección se debe revalidar inmediatamente antes de contratar porque disponibilidad, precios y políticas son variables externas.
