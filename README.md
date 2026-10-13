# Infinity Voice Lab v0.6.0 - candidato de seguridad

No desplegar todavía. Esta versión es un candidato local independiente, sin OpenAI ni llamadas telefónicas.

## Pruebas

`node test.mjs`

## Cambios respecto de v0.5.1

- `GET /health` devuelve la versión candidata.
- `GET /security` exige `Authorization: Bearer <LAB_ACCESS_TOKEN>` y un secreto de al menos 32 caracteres. **Cambia el encabezado respecto a v0.5.1 (`X-Lab-Token`)**.
- Los endpoints de sesiones y OpenAI continúan deshabilitados (403).
- Métodos no permitidos y rutas desconocidas devuelven 405 y 404.
- Restringe CORS a GitHub Pages, sin permitir preflight hasta diseñar la autenticación del navegador.

## Pendientes antes de voz real

- Autenticación de usuarios (no exponer LAB_ACCESS_TOKEN en GitHub Pages).
- Sesiones efímeras firmadas con vencimiento, revocación y límites de 3 minutos.
- Rate limiting real mediante almacenamiento/servicio adecuado; no está implementado en este candidato.
- Revisión de privacidad, consentimiento, costos y límites de gasto.
- Pruebas de despliegue en Worker de ensayo separado antes de producción.
