# Dejar el chatbot (n8n) funcionando en producción para la web real de QUIXA

## Contexto
- La web real es https://portafolio.quixagroup.com: estática (HTML/CSS/JS, sin framework) y publicada en Netlify.
- Se integrará **el módulo del chat dentro de la página** (el widget flotante ya no se usa) y **la página de leads** como entregable. La ubicación de ambos se define en la reunión con el desarrollador.
- No tenemos todavía el repo ni los accesos.
- Lo que preocupa: **cómo dejar funcionando el backend** (el flujo de n8n), porque el frontend es fácil.

**Respuesta corta:** Netlify solo sirve archivos; no puede correr n8n. n8n tiene que vivir en un **servidor encendido 24/7, con HTTPS y su propio subdominio** (por ejemplo `bot.quixagroup.com`). La web de Netlify solo le habla por internet.

```
portafolio.quixagroup.com (Netlify)            bot.quixagroup.com (servidor)
 ├─ módulo del chat  ──POST /webhook/chat──▶   Caddy (HTTPS) ─▶ n8n ─▶ Claude/Gemini
 └─ página de leads  ──GET /webhook/leads──▶        (con login)   └──▶ Postgres (sesiones, memoria, leads)
```

## Qué hay que cambiar en el flujo para que sea de producción
Revisado en `flujo/quixa-consultor-virtual.json` y `flujo/codigo/`. Hoy depende de cosas que solo sirven en el portátil:

| Hoy (demo) | Problema en producción | Cambio |
|---|---|---|
| `Guardar en disco` / `Guardar parcial` (readWriteFile → `leads/*.json`) | Archivos sueltos. La página de leads en Netlify no puede leerlos, y se pierden si se cae el disco | Guardar leads en **Postgres** (tabla `leads`, columna JSONB). Es una sola fuente para la página de leads, los respaldos y luego HubSpot |
| `Memoria` (memoryBufferWindow, en RAM) | Al reiniciar n8n se pierden las conversaciones en curso | **Postgres Chat Memory** |
| Estado de sesiones en `$getWorkflowStaticData` (preparar-mensaje, detectar-cierre, armar-lead, buscar-abandonadas) | Se escribe en cada mensaje y crece sin límite. Con dos mensajes simultáneos uno puede pisar al otro | Aceptable para el piloto (bajo tráfico) si se **limpian sesiones viejas** (>7 días) en `buscar-abandonadas.js`. Pasarlo a Postgres después del piloto |
| `/api/leads` y `/api/metricas` los da `servidor-demo.js` | Ese servidor no existe en producción | Dos webhooks nuevos en n8n: `GET /webhook/leads` y `GET /webhook/metricas`, que leen de Postgres y van **protegidos con autenticación** (Basic/Header Auth del nodo Webhook). Con CORS solo para el dominio de QUIXA |
| Gemini capa gratuita | 15 peticiones/minuto y Google puede usar los datos de la capa gratuita | **Claude** (cambiar los 3 nodos de modelo) o Gemini de pago |
| `$env` en los nodos de código | Funciona en n8n autoalojado (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, ya está en `docker-compose.yml`) | Se mantiene |

## Dónde corre n8n: autoalojado en un VPS (recomendado)
- **VPS** de 2 GB (Hetzner, DigitalOcean o Contabo; unos USD 6–12 al mes) con el paquete que ya existe en `despliegue/`:
  - Docker Compose con n8n 2.41.6, Postgres 16 y Caddy (HTTPS automático)
  - respaldo diario
  - el editor de n8n no queda expuesto a internet
- **¿Por qué no n8n Cloud?** No permite escribir archivos ni leer `$env`, y cuesta unos €24 o más al mes. Igual habría que pasar los leads a una base de datos. Se puede usar más adelante si QUIXA no quiere mantener un servidor.
- **Cuentas a nombre de QUIXA**, para que la entrega sea limpia:
  - VPS
  - Anthropic
  - dominio y DNS
  - usuario administrador de n8n

  Nosotros operamos con acceso delegado.

## Lo que preparamos ahora (sin repo ni accesos)
1. **Flujo de producción** (`versiones/aplicar-prompts-a-flujo.py` genera las dos variantes):
   - nodos Postgres para guardar leads y parciales, en lugar de archivos
   - Postgres Chat Memory
   - webhooks `leads` y `metricas` con autenticación
   - limpieza de sesiones viejas en `flujo/codigo/buscar-abandonadas.js`

   El flujo local sigue funcionando igual para la demo.
2. **`despliegue/sql/001-leads.sql`:** tablas `leads` (id, conversation_id, tipo completa/parcial, creado, datos JSONB) y `metricas`, cargadas automáticamente por el contenedor de Postgres.
3. **Módulo del chat empaquetado** en `modulo-chat/`, listo para entregar al desarrollador:
   - `quixa-chat.js`: basado en `chat-inline.js`, con atributos `data-endpoint`, `data-avatar`, `data-privacidad-url`
   - `quixa-chat.css`: clases con prefijo propio para no chocar con los estilos de la web
   - `fragmento.html`: el bloque HTML de la tarjeta para pegar donde decidan
   - avatar comprimido: `Robot_quixa.png` pesa 1,4 MB
4. **Página de leads empaquetada** en `modulo-leads/`:
   - `leads.html` + `leads.css` que llaman a `https://bot.../webhook/leads` con usuario y contraseña. Los datos no quedan en Netlify.
   - Reemplaza el `login-agentes.html` actual, que **no autentica nada**: su script solo dice que el servicio no está conectado.
5. **Orígenes permitidos:** `QUIXA_ORIGENES` con `https://portafolio.quixagroup.com` y soporte de comodín para las vistas previas de Netlify (`https://*--<sitio>.netlify.app`) en `preparar-mensaje.js`.
6. **Guía para el desarrollador** (`despliegue/INTEGRACION-WEB.md`):
   - qué pegar y dónde
   - CSP en `_headers` o `netlify.toml`
   - cómo probar en una vista previa
7. **Lista de lo que pedir a QUIXA:**
   - VPS
   - registro DNS `bot`
   - cuenta de Anthropic
   - texto legal de privacidad y URL de la política
   - usuarios de la página de leads
   - tiempo de retención de los datos

## Preguntas para la reunión con el desarrollador de QUIXA
1. **Repo y despliegue:**
   - ¿Dónde está el repo (GitHub/GitLab)?
   - ¿Netlify publica desde una rama?
   - ¿Hay vistas previas por rama o PR?
   - ¿Cuál es el dominio `*.netlify.app` del sitio?
2. **Ubicación:**
   - ¿En qué sección y en qué ancho va la tarjeta del chat?
   - ¿La página de leads es un archivo aparte (`leads.html`) o una sección de una página existente?
   - ¿Está enlazada en el menú o oculta?
3. **Estilos:**
   - ¿Qué fuentes y variables CSS usa la web?
   - ¿Hay CSS global (reset, `button`, `input`) que pueda chocar con el chat?
4. **Seguridad del sitio:** ¿tienen `_headers` o `netlify.toml` con Content-Security-Policy? Habría que permitir `bot.quixagroup.com`.
5. **DNS:**
   - ¿Quién maneja quixagroup.com: Netlify DNS u otro proveedor?
   - ¿Quién puede crear el registro `bot`?
6. **Formularios o JS existentes:**
   - ¿La web ya tiene formularios de contacto, scripts de analítica o cookies?
   - Para el aviso de privacidad, ¿hay política de datos publicada y su URL?
7. **Quién mantiene qué:** ¿ellos pegan el módulo y nosotros mantenemos el servidor? ¿Cómo se coordinan los cambios del módulo?

## Pendientes de QUIXA (no técnicos)
- Servidor (VPS) a nombre de QUIXA.
- Cuenta de Anthropic con medio de pago.
- Texto legal del aviso de privacidad.
- Usuarios para la página de leads.
- Tiempo de retención de los datos.
- Validar los pesos del puntaje.
- Decidir la herramienta de agenda: Google Calendar o Cal.com.

## Verificación
- Local con `docker compose up` en `despliegue/`:
  - Postgres crea las tablas
  - se importa el flujo de producción
  - una conversación completa termina como una fila en `leads`
  - n8n reiniciado a mitad de la conversación sigue la conversación (memoria en Postgres)
- `curl /webhook/leads` sin credenciales → 401; con credenciales → la lista.
- `modulo-chat/` y `modulo-leads/` abiertos desde otro puerto (simula Netlify) contra el n8n de Docker: CORS, aviso, envío, historial, cierre, login y visor.
- `node test-guia.js anticonsejo` y la batería (`HOOK=...`) siguen pasando.
