# Infinity Voice v2.1 — Autorización de Etapa 3

**Fecha local de autorización:** 2026-10-14  
**Rama autorizada:** `lab/realtime-v1-1-candidate`

## Alcance autorizado

El propietario autorizó avanzar con la **Etapa 3 — Integración real en laboratorio** bajo estas condiciones:

- proveedor primario: **Telnyx**;
- presupuesto máximo inicial acumulado: **USD 20**;
- únicamente **pruebas internas controladas**;
- se autoriza preparar y configurar el entorno real de laboratorio;
- se autoriza preparar/configurar los secretos necesarios mediante secret managers;
- se autoriza consumir servicios facturables sólo dentro del límite anterior y del alcance de laboratorio;
- se autoriza realizar pruebas reales únicamente con identidades/números internos que sean explícitamente allowlisted antes de cada prueba.

## Lo que NO está autorizado

- prospectos o clientes reales;
- cold calling;
- tráfico comercial;
- campañas o automatizaciones de contacto;
- cambios en Infinity Hub, Meta o WhatsApp;
- cambios en `main`;
- producción masiva;
- grabación de audio por defecto;
- almacenar credenciales en Git, logs, screenshots o payloads;
- gasto acumulado superior a USD 20 sin una nueva autorización explícita.

## Controles obligatorios

1. Fail closed: si falta evidencia de seguridad, presupuesto o allowlist, la prueba no inicia.
2. Concurrencia inicial máxima: 1 llamada.
3. Duración objetivo máxima por prueba: 300 segundos.
4. Límite de diseño por sesión: USD 1; límite diario: USD 5; presupuesto total autorizado: USD 20.
5. `EMERGENCY_STOP=true` y `LIVE_ENABLED=false` son el estado de despliegue inicial.
6. Los secretos sólo se cargan en el secret manager correspondiente; nunca en el repositorio.
7. La primera ruta real se habilita sólo después de comprobar cuenta/proyecto, número de laboratorio, webhook firmado, TLS/SRTP, allowlist y mecanismo de cierre.
8. La autorización de Etapa 3 no autoriza Etapa 4 ni Etapa 5.

## Evidencia y criterio de avance

Un hito de Etapa 3 sólo suma progreso cuando existe evidencia real y verificable del proveedor o del entorno desplegado. Preparar código, workflows o runbooks sin ejecutar proveedores se registra como **bootstrap preparado**, no como integración real validada.
