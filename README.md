# Infinity Voice · Demo móvil v0.2

## Estado
Demo de TEXTO exclusivamente. Funciona en navegador móvil mediante archivos estáticos, sin OpenAI, sin llamadas, sin micrófono, sin claves, sin base de datos y sin conexión a Infinity Hub.

## Publicación desde Android
1. Crear un repositorio NUEVO en GitHub, independiente del repositorio de Infinity Hub.
2. Subir el contenido de esta carpeta a la raíz del repositorio, manteniendo `site/` y `.github/workflows/pages.yml`.
3. En GitHub > Settings > Pages > Build and deployment, elegir **GitHub Actions**.
4. Ejecutar el workflow `Publicar demo estática` si no inicia automáticamente.
5. Abrir la URL que GitHub Pages indique. **GitHub Pages es un sitio público** incluso cuando el repositorio sea privado en muchos planes; por ello NO hay claves, números personales ni datos reales en este demo.

La publicación NO se ha realizado. GitHub Pages puede requerir permisos/plan y configuración adicionales. Alternativamente, se puede subir `site/` a un servicio de hosting estático.

## Próxima fase
Para voz real se necesita un backend separado con autenticación, generación de tokens efímeros, límites de consumo, protección antiabuso y API OpenAI. NO insertar OPENAI_API_KEY en `site/` ni en el repositorio público. Validar precios, saldo y modelo antes de activarlo. No usar el número corporativo de Infinity Living ni producción.

## Pruebas de alcance
El demo usa JavaScript del navegador y no solicita permisos ni envía datos por red. Límite de 180 segundos, flujo de calificación, salida por no contacto y devolución sin programar llamadas.
