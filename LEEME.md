# QUIXA · Consultor Virtual — Demo

Prototipo conversacional para la reunión del **lunes 5 de octubre de 2026**.
Corre **entero en local** y **sin costo**: n8n autoalojado + Gemini en su capa gratuita.

---

## Arrancar

```bash
./iniciar-demo.sh
```

Abre luego:

| | |
|---|---|
| **Sitio de QUIXA** (con el chat) | http://localhost:8080 |
| **Leads capturados** | http://localhost:8080/leads.html |
| **Flujo en n8n** | http://localhost:5678 |

Usuario de n8n: `demo@quixa.local` · clave: `QuixaDemo2026`

Para detener todo: `./detener-demo.sh`

> La primera vez n8n tarda ~40 segundos en levantar. El script espera solo.

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

Para cambiar el comportamiento: edita `prompts/orientador.md` o `prompts/extractor.md` y aplica con
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

1. **Abre http://localhost:8080** y muestra el sitio. Haz clic en el botón del chat.
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
3. **Al cerrar**, abre http://localhost:8080/leads.html y muestra el registro:
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
