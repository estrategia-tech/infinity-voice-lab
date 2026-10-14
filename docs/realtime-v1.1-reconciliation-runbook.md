# Infinity Voice Lab v1.1 — conciliación de sesiones (solo laboratorio)

**Estado:** diagnóstico offline. No se ejecutan llamadas a OpenAI ni se libera capacidad automáticamente.

## Fuentes de verdad
- `LabSessionLedger`: reserva, caducidad, vinculación `callId`, liberación explícita. La reserva caducada **permanece ocupada** hasta su liberación.
- `AlarmLabLedger`: alarma persistente **separada** y simulaciones de terminación. El estado `mock_terminated` **no** prueba desconexión real ni libera capacidad del primer registro.
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
Antes de solicitar autorización del usuario: unificar o enlazar de forma transaccional la reserva y el programador de alarmas, instalar un proceso de desconexión real desde servidor, verificar el estado de la llamada con evidencia del proveedor cuando esté disponible, controlar secretos y permisos, comprobar cierre en fallos y contar con supervisión del gasto. El ACK HTTP de hangup no es una garantía contractual de facturación. Ninguna conciliación debe liberar capacidad basándose únicamente en el reloj o en una simulación.

**Prohibido:** exponer endpoints `/__local/*`, reutilizar credenciales sintéticas en producción, modificar Hub/WhatsApp, iniciar sesiones pagadas sin autorización.
