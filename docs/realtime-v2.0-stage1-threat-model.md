# Infinity Voice v2.0 — Etapa 1 Threat Model y criterio de salida

**Ámbito:** laboratorio offline en `lab/realtime-v1-1-candidate`. Este documento no autoriza despliegues, proveedores reales, credenciales reales, telefonía, OpenAI ni gasto.

## Activos que se protegen

- Identidad lógica de la sesión.
- Capacidad de abrir, cerrar o cancelar una sesión de proveedor.
- Credenciales futuras y su alcance.
- Evidencia de terminación usada para liberar concurrencia/capacidad.
- Separación entre laboratorio y producción.
- Presupuesto futuro y prevención de consumo no autorizado.

## Límites de confianza

1. **Orquestador → credencial:** el emisor debe negar scopes no autorizados y producir credenciales de corta duración.
2. **Credencial → adaptador de proveedor:** el receptor debe verificar firma, sesión, contexto, origen, scope, expiración, revocación y replay antes de aceptar una operación.
3. **Proveedor → supervisor:** errores, timeouts o desconexiones no equivalen a terminación confirmada.
4. **Supervisor → control de capacidad:** sólo una confirmación explícita de terminación puede liberar capacidad.
5. **Laboratorio → mundo exterior:** ningún módulo de Etapa 1 realiza red, telefonía, lectura de secretos o llamadas facturables.

## Amenazas y controles implementados

| Amenaza | Control de Etapa 1 | Resultado esperado |
|---|---|---|
| Token alterado | Firma Ed25519 offline | Rechazo |
| Reutilización de token | `jti` + replay guard | Rechazo |
| Token comprometido | Registro explícito de revocación | Rechazo |
| Cross-session | Binding a `sessionId` | Rechazo |
| Cross-context | Binding a `contextId` | Rechazo |
| Origen distinto | Binding a origen de laboratorio | Rechazo |
| Elevación de privilegios | Allowlist de scopes en emisión y verificación | Rechazo |
| Credencial demasiado larga | TTL máximo 60 s | Rechazo |
| Confirmación tardía | Deadlines del supervisor | Estado `uncertain` |
| Timeout de cierre | No libera capacidad | Fail closed |
| Cancelación sin acuse | No libera capacidad | Fail closed |
| Fallo del proveedor | No se interpreta como hangup | Estado `uncertain` |
| Receipt falso | Receipt mock exacto y transición válida | Rechazo |
| Evento fuera de secuencia | Contrato de proveedor con secuencia estricta | Rechazo |

## Riesgos residuales deliberadamente pendientes

- No existe un issuer real autenticado ni gestión de claves persistente.
- No existe KMS/HSM, rotación de claves, almacenamiento seguro de secretos ni revocación distribuida.
- El origen es un identificador simulado, no una prueba de canal TLS o attestation.
- Los receipts son exclusivamente mocks y nunca constituyen evidencia de proveedor real.
- No existe proveedor realtime, media plane, audio real ni telefonía.
- No se han definido todavía privacidad de audio, consentimiento, retención ni redacción operativa.
- Controles de presupuesto, concurrencia global y kill switch pertenecen a Etapa 4.

## Criterio de salida de Etapa 1

La Etapa 1 sólo puede marcarse completada cuando, sobre el mismo HEAD de la rama autorizada:

1. El contrato de proveedor simulado y su lifecycle están verdes.
2. La credencial firmada offline está verde.
3. Revocación, origin/context binding y allowlist de scopes están verdes.
4. Timeout/cancelación y evidencia de terminación están verdes.
5. La regresión integrada de Etapa 1 está verde.
6. El workflow `Infinity Voice v2.0 Design Only Gate` termina en `success`.
7. No se ha utilizado ninguna credencial real, servicio externo, proveedor de voz, telefonía ni despliegue.

**Regla permanente:** ante incertidumbre de autorización, identidad, estado del proveedor o terminación, el sistema debe fallar cerrado y requerir revisión manual.
