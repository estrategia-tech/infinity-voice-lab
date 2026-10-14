# Infinity Voice Lab v1.1 — conciliación de sesiones (solo laboratorio)

**Estado:** diagnóstico offline. No se ejecutan llamadas a OpenAI ni se libera capacidad automáticamente.

## Fuentes de verdad
- `LabSessionLedger`: reserva, caducidad, vinculación `callId`, **alarma nativa en el mismo Durable Object** y liberación explícita. Al vencer, marca `expired_unterminated` y conserva capacidad. Si falla la programación, marca `alarm_schedule_failed` y conserva capacidad.
- `AlarmLabLedger`: laboratorio histórico de alarma **separada** y simulaciones de terminación. El estado `mock_terminated` **no** prueba desconexión real ni libera capacidad del primer registro.
- `reconcileLabState`: compara ambos registros mediante stubs internos y devuelve un diagnóstico de solo lectura.

## Diagnóstico
1. `unbound_reservation`: existe reserva sin `callId`; investigar si se creó una sesión antes de permitir una liberación.
2. `alarm_binding_missing_or_mismatched`: llamada vinculada sin alarma coincidente; **bloquear** nuevas admisiones.
3. `expired_unverified` o `expired_unterminated`: venció el tiempo sin evidencia de desconexión; **no** liberar.
4. `mock_termination_not_provider_proof`: simulación exitosa; **no** liberar.
5. `mock_termination_failed`: agotados los intentos sintéticos; requiere revisión.
6. `orphanAlarm`: alarma sin reserva/callId correspondiente; investigar estado inconsistente.
7. `reconciliation_unavailable`: falló consulta/estructura; detener el flujo y conservar capacidad.

## Puerta para pruebas pagadas
Antes de solicitar autorización del usuario: verificar el funcionamiento y persistencia de la alarma nativa del mismo Durable Object en CI (la programación ocurre después de guardar la vinculación, por lo que un fallo queda marcado y bloquea nuevas admisiones), instalar un proceso de desconexión real desde servidor, verificar el estado de la llamada con evidencia del proveedor cuando esté disponible, controlar secretos y permisos, comprobar cierre en fallos y contar con supervisión del gasto. El ACK HTTP de hangup no es una garantía contractual de facturación. Ninguna conciliación debe liberar capacidad basándose únicamente en el reloj o en una simulación.

**Prohibido:** exponer endpoints `/__local/*`, reutilizar credenciales sintéticas en producción, modificar Hub/WhatsApp, iniciar sesiones pagadas sin autorización.

## Prueba de persistencia nativa agregada a CI
La suite `realtime-v1.1-local-do.yml` crea una reserva, vincula un `rtc_*` sintético, reinicia Wrangler con el mismo directorio persistente y espera hasta 160 segundos para verificar que la alarma del **mismo** Durable Object marca `expired_unterminated`. Después comprueba que una nueva reserva sigue bloqueada (HTTP 429). Esta prueba no simula una desconexión real del proveedor.

La validación es distinta de la suite histórica `realtime-v1.1-alarm-local.yml`, que conserva los escenarios aislados de alarmas simuladas.

## Diagnóstico autoritativo (nuevo)
`reconcilePrimaryLedger` consulta exclusivamente el registro principal con su alarma nativa, y clasifica `pending`, `expired_unverified`, `expired_unterminated`, `alarm_schedule_failed`, `expired_unbound` y estados desconocidos. Ningún resultado implica que el proveedor terminó ni autoriza una liberación. `reconcileLabState` permanece como comparador histórico de dos registros para investigar divergencias del simulador.
