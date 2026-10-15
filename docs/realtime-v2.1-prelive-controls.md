# Infinity Voice v2.1 — controles pre-live

**Ámbito:** controles que deben existir antes de cualquier prueba facturable. Este documento no autoriza una llamada real.

## 1. Secretos y credenciales

- API keys y passwords SIP sólo server-side.
- No incluir secretos en Git, documentación, logs, navegador, URL, query string ni mensajes de error.
- Para Cloudflare usar Secrets/Secrets Store, no variables plaintext.
- Los entornos local/lab/prod deben tener secretos separados.
- Ninguna credencial real se cargará hasta autorización explícita.

## 2. Admisión y presupuesto

Estado por defecto:

- `liveAuthorization=false`
- `approvedBudgetUsd=0`
- `allowedTestNumbers=[]`
- `allowExternalProspects=false`
- `allowColdCalls=false`

Una sesión real futura sólo puede admitirse si simultáneamente existe autorización del propietario, presupuesto positivo dentro del hard cap, destino interno allowlisted, consentimiento de la persona de prueba, proveedor listo, OpenAI outbound SIP habilitado, secret store listo, kill switch listo y monitoreo listo.

Límites iniciales propuestos: 1 llamada concurrente, 300 s por sesión, 3 llamadas/día, USD 1 por sesión, USD 5/día y USD 20 como techo de diseño del piloto inicial.

## 3. Kill switch y fail closed

El control plane futuro debe tener un `emergencyStop` server-side. Si está activo, faltan datos, no puede leerse el presupuesto, el proveedor está ambiguo, el estado de cierre es desconocido o la política no puede evaluarse, **no se crea una nueva llamada**.

El kill switch debe poder bloquear admisiones sin depender del proveedor. En una etapa live deberá probarse que realmente evita crear sesiones aun cuando las credenciales sean válidas.

## 4. Privacidad y consentimiento

Para Etapas 3–4 sólo se permiten identidades internas de prueba que hayan aceptado recibir la llamada.

Configuración recomendada inicial:

- `store=false` en OpenAI.
- Grabación de audio deshabilitada.
- No persistir audio.
- Logs técnicos mínimos: IDs opacos, timestamps, estado, duración, códigos de error y costo; evitar contenido conversacional y PII.
- No pedir ni almacenar CURP, identificación, datos financieros, bancarios, salud u otros datos sensibles.
- Si una conversación intenta introducir información sensible, el flujo debe evitar persistirla y escalar cuando corresponda.

Antes de llamar a prospectos se requiere revisión específica del aviso de privacidad, finalidades, consentimiento, conservación, derechos ARCO y cualquier disclosure aplicable.

## 5. Política comercial de llamadas

- No cold calling durante el piloto.
- Primer piloto comercial futuro: sólo leads que hayan solicitado información o hayan otorgado consentimiento verificable para ser contactados.
- Mantener evidencia del origen/fecha del consentimiento y mecanismo de opt-out.
- Respetar solicitudes de no contacto inmediatamente.
- Antes de campañas telefónicas más amplias, revisar el REPEP y la estrategia jurídica aplicable.

PROFECO establece que no debe enviarse publicidad a consumidores inscritos en REPEP o que hayan manifestado no querer recibirla, salvo supuestos como consentimiento expreso. Infinity Voice usará un estándar interno más conservador: **sin consentimiento verificable, no hay llamada comercial automatizada**.

## 6. Transparencia del asistente

Aunque la obligación jurídica concreta deberá revisarse antes del piloto con prospectos, la política de Infinity Living será identificarse de forma clara al inicio como asistente virtual/automatizado de Infinity Living y ofrecer una ruta sencilla hacia una persona.

## 7. Cierre y capacidad

- Un timeout local no equivale a cierre real.
- No liberar slot ni marcar `terminated-confirmed` sin la evidencia requerida del proveedor/Live API.
- Reintentos de creación de llamadas deben ser idempotentes o estar protegidos para evitar llamadas duplicadas.
- Ante ambigüedad, bloquear nueva admisión y enviar a revisión humana.

## 8. Lo que sigue bloqueado

Hasta autorización separada no se puede:

- crear/comprar/configurar trunk o número;
- cargar saldo o método de pago;
- usar OpenAI API con créditos;
- habilitar outbound SIP;
- desplegar cambios en Cloudflare;
- colocar llamadas;
- conectar Infinity Hub, Meta o WhatsApp;
- llamar a clientes/prospectos;
- activar grabación o almacenamiento de sesiones.

## Revisión profesional recomendada

Antes de Etapa 5 con prospectos, un abogado de privacidad/consumo en México debe revisar el aviso de privacidad, consentimiento, disclosure y política de llamadas. Este documento es un control técnico-operativo y no sustituye dictamen legal.
