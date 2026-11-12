# QUIXA · Consultor Virtual

Chatbot consultor para la web de QUIXA: conversa con el visitante siguiendo la Guía de preguntas, lo orienta al servicio
adecuado y deja una ficha del lead para el consultor. Construido con n8n (autoalojado) y un modelo de IA (hoy Gemini).

**Estado (noviembre 2026):** versión 3, preparada para el MVP. Ver la sección «Versión 3» más abajo.

| Para… | Ver |
|---|---|
| Probarlo en un computador | «Arrancar», aquí abajo |
| Instalarlo en un servidor (VPS con Docker, HTTPS y Postgres) | [`despliegue/LEEME.md`](despliegue/LEEME.md) |
| Llevarlo a producción con la web de QUIXA (Netlify) | [`despliegue/PLAN-PRODUCCION.md`](despliegue/PLAN-PRODUCCION.md) |
| Cambiar cómo conversa | `prompts/orientador.md` (sección «Versión 2») |

La primera versión fue un prototipo para la reunión del **lunes 5 de octubre de 2026**. Corre **entero en local** y
**sin costo**: n8n autoalojado + Gemini en su capa gratuita.

---

## Arrancar

```bash
./iniciar-demo.sh
```

Abre luego:

| | |
|---|---|
| **Sitio de QUIXA** (con el chat) | http://localhost:8090 |
| **Leads capturados** | http://localhost:8090/leads.html |
| **Flujo en n8n** | http://localhost:5678 |

Usuario de n8n: `demo@quixa.local` · clave: `QuixaDemo2026`

Para detener todo: `./detener-demo.sh`

> La primera vez n8n tarda ~40 segundos en levantar. El script espera solo.

---

## Versión 3 — Preparación del MVP (4 nov 2026)

Lo que se adelantó sin necesitar cuentas externas:

| Requisito | Qué se hizo |
|---|---|
| RNF-04 Control de abuso | Tope de **30 mensajes por sesión** (el bot cierra a tiempo y el lead no se pierde), **1.000 caracteres** por mensaje y **120 mensajes por hora por IP**. Los bloqueos se responden sin llamar a la IA. |
| RNF-03 Seguridad | **Orígenes permitidos** por variable (`QUIXA_ORIGENES`). La ficha del lead **ya no viaja al navegador** (antes salía completa, con la referencia interna de inversión). |
| RNF-05 Privacidad | **Aviso de privacidad y aceptación antes de empezar** (texto provisional, a reemplazar por el legal de QUIXA). Cada lead guarda la versión y fecha de la aceptación. |
| RF-05 Calificación | **Puntaje 0–100** con categoría caliente / tibio / frío, desglosado por componente. **Provisional**: pesos pendientes de validar con QUIXA. |
| RF-07 / RF-08 | Cada lead trae listos los **campos para HubSpot** y el **correo al consultor** (asunto con «[ATENCIÓN]» en casos urgentes). Se ven en el visor. Falta conectar las cuentas. |
| RF-10 Memoria | El chat **conserva el historial al recargar** la página y ofrece «Empezar una nueva conversación» al cerrar. |
| RF-11 Origen | Guarda `ref`, **UTM** y página de procedencia. |
| Abandonos | Cada 10 minutos, las conversaciones con **30 min sin actividad** se guardan como lead **«parcial»** (sin IA, respuestas literales). |
| Métricas del piloto | Conversaciones iniciadas, cerradas, abandonadas y **% que completa** (meta ≥ 30%), arriba en el visor. |
| RNF-07 / RNF-08 | El código de los nodos vive en `flujo/codigo/*.js`. Paquete **Docker** en `despliegue/` (n8n + Postgres + HTTPS con Caddy + respaldo diario). Ver `despliegue/LEEME.md`. |

Variables de entorno de los nodos (todas opcionales en local): `QUIXA_ORIGENES`, `QUIXA_MAX_MENSAJES_SESION`,
`QUIXA_MAX_CARACTERES`, `QUIXA_MAX_MENSAJES_IP_HORA`, `QUIXA_MINUTOS_INACTIVIDAD`, `QUIXA_CORREO_CONSULTOR`, `QUIXA_URL_VISOR`.

El sitio corre en el puerto **8090** (el 8080 lo usa otro proyecto). Para otro puerto: `PORT=8091 ./iniciar-demo.sh`.

**Batería de aceptación** (criterio «≥ 90% correctas y cero promesas»): `node pruebas/bateria.js` hace 50 preguntas típicas
(precios, promesas, temas fuera del portafolio, pedir una persona, intentos de sacar las instrucciones) y marca
automáticamente descuentos, garantías, plazos, precios no publicados, comisiones y **hechos inventados**. El detalle queda en
`pruebas/resultados/` para la revisión humana. Primera corrida (4 nov): el bot inventaba casos de clientes, países, modalidad
virtual y especialidades del equipo; se corrigió en `prompts/orientador.md` y ahora responde que lo confirma el equipo.

---

## Versión 2 — Guía de preguntas + enfoque QUIXA (26 oct 2026)

La conversación sigue la **Guía de preguntas y lógica conversacional** de QUIXA y el
enfoque del **Portafolio 2026** y del **Proceso que vive el cliente**:

1. **Chat general** (G1–G6): nombre y cargo, empresa, años y etapa, reto, qué espera lograr, si sabe qué necesita.
2. **Orientación** (OR): qué conviene explorar y por qué. El **Anticonsejo 1:1 es la puerta de entrada** por defecto.
3. **Chat especializado**: Anticonsejo (AC1–AC5, filtro textual), Estrategia (ES), Junta Asesora (JA), Proyectos (PC) o Embajadores (EM).
4. **Cierre obligatorio** (C1–C6, ventas VT, autorización AUT) y despedida.

Cómo funciona por dentro:

- Cada mensaje del agente termina con un **código** (`[[Q:AC2]]`) que el navegador no ve.
- **n8n lleva una máquina de estados**: recuerda qué preguntas ya se hicieron y en cada turno le dice al modelo cuáles faltan. Así el modelo gratuito no se salta pasos.
- La **respuesta literal** de cada pregunta la guarda el código, no la IA (Guía §9). La IA solo agrega resumen, tipo de evidencia y clasificación.
- La ficha incluye el **perfilamiento QUIXA**: los tres problemas de fondo (crecimiento sin rumbo, zona de copia, soledad del dueño), frenos, señales de alerta, **ajuste al perfil de cliente ideal** (calculado en código), ruta posterior probable, **preparación para el consultor** (hipótesis, datos a investigar, preguntas para la sesión) y referencia interna de inversión.

Para cambiar el comportamiento: edita `prompts/orientador.md`, `prompts/extractor.md` o `flujo/codigo/*.js` y aplica con
`python3 versiones/aplicar-prompts-a-flujo.py "$PWD"`; luego sube el flujo a n8n (o impórtalo).
Prueba de punta a punta: `node test-guia.js anticonsejo|estrategia|embajador`.
La versión del 5 de octubre está respaldada en `versiones/v1-demo-lunes/`.

---

## Qué hace (versión 1)

1. El visitante abre el chat en la web de QUIXA.
2. El consultor virtual **diagnostica**: entiende quién es, qué empresa tiene y cuál es su reto. Profundiza cuando la respuesta es vaga.
3. Cuando comprende el reto, el impacto, la urgencia y la expectativa, **orienta** hacia uno de los cinco servicios del portafolio y **explica por qué**.
4. Valida la orientación con el cliente, pide los datos de contacto y la autorización de uso.
5. Muestra un **resumen** para que el cliente lo corrija.
6. Al cerrar, genera un **registro estructurado de ~50 campos** y lo guarda en `leads/`.

El bot nunca inventa servicios ni precios, nunca promete resultados, y siempre aclara que es una **orientación preliminar** y que la decisión final es de QUIXA.

---

## Arquitectura

```
navegador
   │  widget de chat (una línea de <script>)
   ▼
n8n  (local, puerto 5678)
   │
   ├── Consultor QUIXA ....... agente conversacional + memoria por sesión
   ├── Leer conversación ..... recupera la transcripción completa
   ├── Extraer registro ...... convierte la conversación en ~50 campos
   └── Guardar en disco ...... leads/*.json
   │
   ▼
Gemini (capa gratuita)
```

### Por qué n8n

El flujo está construido con **nodos, no con código**. Cada pieza es
reemplazable sin tocar las demás, que es justo el argumento para el MVP:

| Hoy (demo, gratis y local) | Mañana (MVP en producción) |
|---|---|
| Gemini capa gratuita | Claude Sonnet, cambiando **un solo nodo** |
| Memoria en el proceso de n8n | Postgres + pgvector |
| `leads/*.json` en disco | HubSpot + correo al consultor |
| n8n en el portátil | n8n en un VPS con Docker |
| Página de demostración | La web real de QUIXA |

**El flujo conversacional no cambia.** Eso es lo que se defiende el lunes.

---

## El widget

Se instala en cualquier página con una línea:

```html
<script src="/widget/quixa-chat.js"
        data-endpoint="http://localhost:5678/webhook/chat"></script>
```

Cuando QUIXA entregue su web, solo cambia `data-endpoint`. Funciona en
escritorio y móvil, y no depende de ningún framework.

---

## Guion sugerido para la demostración

1. **Abre http://localhost:8090** y muestra el sitio. Haz clic en el botón del chat.
2. **Conversa como un empresario.** Sugerencia probada:
   - «Soy Carlos Gómez» → «Soy el dueño y gerente general»
   - «Distrialimentos. Distribuimos alimentos, llevamos 14 años»
   - «La empresa creció, pero hacemos muchas cosas y no sabemos cuáles priorizar»
   - «Tenemos muchas oportunidades y cada área propone algo diferente»
   - «Estamos dispersando recursos y yo termino tomando casi todas las decisiones»
   - «Hicimos reuniones de planeación, pero volvemos a lo mismo»
   - «En los próximos tres meses»
   - «Quiero claridad sobre dónde jugar, qué priorizar y una ruta para ejecutar»
   - Acepta la orientación, da correo y teléfono, autoriza, confirma el resumen.
3. **Al cerrar**, abre http://localhost:8090/leads.html y muestra el registro:
   los campos clasificados, el motivo de la orientación y el resumen para el consultor.
4. **Abre n8n** (http://localhost:5678) y muestra el canvas: cada caja es una
   decisión visible y reemplazable.

> Prueba la conversación **una vez antes de la reunión** para calentar el flujo.

---

## Límites conocidos (y por qué no importan todavía)

| Límite | Detalle |
|---|---|
| **Cuota de Gemini** | La capa gratuita permite ~15 peticiones por minuto y por modelo. Una conversación usa una por turno. Con **una persona conversando va sobrado**; varias a la vez lo agotarían. |
| **Sin persistencia real** | Los leads son archivos. En el MVP van a HubSpot. |
| **Memoria en proceso** | Si n8n se reinicia, las conversaciones en curso se pierden. |
| **Solo local** | No hay HTTPS ni dominio: es una demostración, no un despliegue. |

Para que la cuota no tumbe la demo, cada etapa usa un **modelo distinto**
(las cuotas son independientes por modelo) y el agente tiene un **modelo de
respaldo automático**:

- Conversación → `gemini-3.5-flash-lite`, con respaldo en `gemini-2.5-flash`
- Extracción del registro → `gemini-3.5-flash`

Si aun así la extracción falla, **la conversación cierra igual** y el caso
queda marcado como `revision_humana`.

---

## Archivos

```
iniciar-demo.sh / detener-demo.sh   arrancar y parar todo
prompts/orientador.md               cómo conversa el consultor  ← el corazón
prompts/extractor.md                cómo se arma el registro
flujo/quixa-consultor-virtual.json  el flujo de n8n (importable)
widget/quixa-chat.js                el chat embebible
index.html / leads.html             sitio de demostración y visor de leads
servidor-demo.js                    servidor estático + /api/leads
leads/                              un JSON por conversación cerrada
test-guion.js                       prueba automática de punta a punta
.env                                claves — NO compartir
```

Para ajustar el tono o las preguntas del bot, se edita
**`prompts/orientador.md`** y se pega en el nodo *Consultor QUIXA* de n8n.

---

## Seguridad

La clave de Gemini está en `.env` (ignorado por git) y dentro de las
credenciales cifradas de n8n. **Esa clave se compartió por chat, así que
conviene rotarla en https://aistudio.google.com/apikey cuando termine la demo.**

Para cambiarla: `./cambiar-clave-gemini.sh` (pide la clave, la prueba, la guarda en `.env` y en n8n, y reinicia la demo).
