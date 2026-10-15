# Infinity Voice v2.1 — modelo de costos del piloto

**Objetivo:** tener un presupuesto conservador antes de habilitar cualquier servicio facturable. No es una cotización de proveedor.

## Datos públicos usados

- OpenAI GPT-Live `gpt-live-1`: **USD 0.05/min de sesión**. El uso de modelos backend y tools se cobra aparte.
- Telnyx SIP Trunking: tarifas públicas generales desde aproximadamente **USD 0.005/min outbound**, pero la ruta exacta a México es variable y debe verificarse en cuenta antes de llamar.
- Twilio México como referencia de mercado publicada: local outbound **USD 0.016/min** y móvil outbound **USD 0.0473/min**; Media Streams, si se usara, añade costo por minuto. Twilio no es la opción primaria de v2.1.
- Tipo de cambio de planeación consultado al preparar este documento: **1 USD = 18.4696 MXN**. Es sólo una referencia temporal.

## Piso técnico conocido

GPT-Live + mínimo público genérico de trunk Telnyx:

`0.05 + 0.005 = USD 0.055/min` antes de ruta específica, impuestos, tools y cualquier servicio adicional.

Equivale aproximadamente a **MXN 1.02/min** al tipo de cambio de referencia.

## Envolvente conservadora para el piloto

Como la tarifa exacta mexicana de Telnyx y el uso backend aún no están confirmados, usar para planeación:

- **Banda baja:** USD 0.08/min ≈ MXN 1.48/min.
- **Banda alta:** USD 0.15/min ≈ MXN 2.77/min.

Esta banda NO afirma que ése será el precio final. Es una reserva de planeación para evitar subestimar el piloto.

## Escenarios

| Escenario | Minutos totales | Banda baja USD | Banda alta USD | Banda aprox MXN |
|---|---:|---:|---:|---:|
| 1 llamada de 5 min | 5 | 0.40 | 0.75 | 7.39–13.85 |
| 10 llamadas de 5 min | 50 | 4.00 | 7.50 | 73.88–138.52 |
| 20 llamadas de 5 min | 100 | 8.00 | 15.00 | 147.76–277.04 |
| 50 llamadas de 5 min | 250 | 20.00 | 37.50 | 369.39–692.61 |

No se incluyen renta de número, impuestos ni cargos extraordinarios del carrier.

## Límites propuestos

Los límites de diseño se preparan desde ahora, pero el gasto autorizado permanece en **USD 0** hasta aprobación del propietario.

- Hard cap de diseño del piloto inicial: **USD 20 total**.
- Cap diario recomendado tras autorización: **USD 5**.
- Cap por sesión: **USD 1**.
- Duración máxima por llamada interna: **300 s (5 min)**.
- Concurrencia: **1**.
- Máximo de llamadas internas por día: **3** durante la primera ronda.

Con estos límites, un bug no debería poder escalar silenciosamente a un gasto grande. Cualquier cambio de cap requiere modificación explícita y nueva evidencia de gate.

## Criterio de desbloqueo

Antes de cambiar presupuesto aprobado de 0 a un valor positivo deben existir:

1. tarifa real del destino/número en la cuenta de proveedor;
2. número/trunk de laboratorio identificado;
3. OpenAI outbound SIP habilitado;
4. secrets server-side configurados;
5. kill switch operativo;
6. destino interno allowlisted;
7. autorización escrita del propietario indicando máximo de gasto.
