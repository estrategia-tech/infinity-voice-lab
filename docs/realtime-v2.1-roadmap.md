# Infinity Voice v2.1 — roadmap de piloto real controlado

**Rama autorizada:** `lab/realtime-v1-1-candidate`

**Regla:** ningún porcentaje se gana por intención. Un hito suma 4% global únicamente cuando tiene artefacto/documento terminado, revisión o prueba verificable y evidencia en GitHub. `100% v2.1` significará preparación para un piloto comercial limitado; no producción masiva.

## Etapa 1 — Arquitectura real y proveedores (20%)

1. Arquitectura objetivo de punta a punta — **VALIDADO**.
2. Comparación de proveedores de telefonía/voz — **VALIDADO**.
3. Modelo de IA y arquitectura conversacional — **VALIDADO**.
4. Modelo de costos por minuto/llamada/piloto — **VALIDADO**.
5. ADR de arquitectura recomendada y criterios de cambio — **VALIDADO**.

**Etapa 1: 20/20%.**

Decisión técnica actual: Telnyx SIP Trunk + OpenAI GPT-Live (`gpt-live-1`) mediante SIP directo; Cloudflare Worker + Durable Object como control plane futuro, sin media bridge propio en el camino primario. La decisión no crea cuentas, no compra números, no carga saldo, no habilita SIP y no despliega nada.

## Etapa 2 — Seguridad, costos y controles pre-live (20%)

1. Diseño de manejo de secretos server-side — **VALIDADO**.
2. Presupuesto, duración y límites de concurrencia con default de gasto real en cero — **VALIDADO**.
3. Kill switch y fail-closed admission gate — **VALIDADO**.
4. Política de privacidad/consentimiento/retención para el piloto — **VALIDADO**.
5. Gate automatizado de pre-live y checklist de intervención humana — **VALIDADO**.

**Etapa 2: 20/20%.**

Importante: “VALIDADO” en esta etapa significa que los controles pre-live están especificados y probados offline. No significa que ya estén desplegados en Cloudflare/Telnyx/OpenAI.

## Etapa 3 — Integración real en laboratorio (0/20%)

1. Cuenta/proyecto de proveedor y número/trunk de laboratorio aprobados.
2. OpenAI Live con outbound SIP habilitado y credencial server-side almacenada como secret.
3. Primer handshake SIP cifrado real, exclusivamente a identidad de prueba allowlisted.
4. Sideband/monitoring real, hangup verificable y kill switch probado.
5. Coste real medido y conciliado contra límites.

**Bloqueo actual:** requiere intervención del propietario para autorizar proveedor, presupuesto y uso de credenciales/servicios facturables.

## Etapa 4 — Piloto interno controlado (0/20%)

1. Primera llamada interna autorizada.
2. Audio bidireccional estable y latencia medida.
3. Barge-in/interrupciones/cierre correctos.
4. Herramientas permitidas y escalamiento humano controlado.
5. Serie de pruebas internas con métricas y reporte.

## Etapa 5 — Preparación de piloto comercial (0/20%)

1. Guion/identidad de asistente y disclosure validados.
2. Material inmobiliario verificable conectado con controles de fuente.
3. Consentimiento, privacidad, REPEP y flujo de opt-out revisados para prospectos.
4. Dashboard/runbook/incident response/rollback operativos.
5. Go/No-Go formal para un piloto limitado con prospectos que hayan consentido contacto.

## Progreso v2.1

- Etapa 1: **20/20%**
- Etapa 2: **20/20%**
- Etapas 3–5: **0/60%**
- **Global: 40%**

## Frontera de autorización

Hasta una autorización explícita posterior permanecen en `false` o cero: `liveAuthorization`, gasto aprobado, llamadas reales, compra/portabilidad de números, creación/configuración de trunk, carga de credenciales, cambios en Cloudflare, OpenAI, Telnyx, Infinity Hub, Meta o WhatsApp.
