# Despliegue en servidor (MVP)

Monta el consultor virtual en un VPS con **HTTPS**, **Postgres** y **reinicio automático**.
Solo quedan públicos el archivo del widget y el webhook del chat; el editor de n8n se usa por túnel SSH.

```
internet ──HTTPS──▶ Caddy ──▶ /widget/quixa-chat.js   (archivo estático)
                          └─▶ /webhook/chat  ──▶ n8n ──▶ Postgres
                                                  └──▶ datos/leads/*.json
```

## Requisitos

- VPS con Ubuntu 24.04, 2 GB de RAM, Docker y Docker Compose.
- Un registro DNS **A** del subdominio (por ejemplo `bot.quixagroup.com`) apuntando a la IP del VPS.
- Puertos 80 y 443 abiertos.

## Pasos

```bash
# 1. Copiar el proyecto al servidor (sin node_modules, .n8n-data ni leads de prueba)
rsync -av --exclude node_modules --exclude .n8n-data --exclude leads --exclude .env ./ usuario@servidor:/opt/quixa/

# 2. En el servidor: configurar
cd /opt/quixa/despliegue
cp .env.ejemplo .env && nano .env          # completar dominio, orígenes y claves
mkdir -p datos/leads && sudo chown 1000:1000 datos/leads

# 3. Levantar
docker compose up -d
docker compose logs -f caddy               # esperar "certificate obtained"

# 4. Generar el flujo para el servidor e importarlo
set -a; . ./.env; set +a
QUIXA_DIR_LEADS=/data/leads QUIXA_ORIGENES="$QUIXA_ORIGENES" \
  python3 ../versiones/aplicar-prompts-a-flujo.py .. ./datos/flujo-servidor.json
docker compose cp ./datos/flujo-servidor.json n8n:/tmp/flujo.json
docker compose exec n8n n8n import:workflow --input=/tmp/flujo.json
```

5. **Entrar al editor** desde tu computador: `ssh -L 5678:localhost:5678 usuario@servidor` y abrir http://localhost:5678.
   Crear el usuario administrador y, en el nodo *Gemini*, crear la credencial de la IA (n8n la asigna también a *Gemini respaldo*
   y *Gemini extractor*). Guardar con Ctrl+S y **publicar** el flujo (botón *Publish*).

6. **Copias de seguridad diarias**: `crontab -e` y agregar
   `15 3 * * * /opt/quixa/despliegue/respaldo.sh >> /var/log/quixa-respaldo.log 2>&1`

7. **Instalar el chat en la web de QUIXA** (una línea antes de `</body>`):

```html
<script src="https://bot.quixagroup.com/widget/quixa-chat.js"
        data-endpoint="https://bot.quixagroup.com/webhook/chat"
        data-privacidad-url="https://quixagroup.com/politica-de-datos"></script>
```

## Comprobar que quedó bien

```bash
# Debe responder el saludo del bot
curl -s https://bot.quixagroup.com/webhook/chat -H 'Content-Type: application/json' \
  -H 'Origin: https://quixagroup.com' -d '{"sessionId":"prueba-1","message":"__INICIO__"}'

# Desde un origen no permitido debe responder el aviso de bloqueo
curl -s https://bot.quixagroup.com/webhook/chat -H 'Content-Type: application/json' \
  -H 'Origin: https://otro-sitio.com' -d '{"sessionId":"prueba-2","message":"hola"}'

# El editor de n8n NO debe abrir desde internet (404)
curl -s -o /dev/null -w '%{http_code}\n' https://bot.quixagroup.com/
```

## Lo que falta conectar (necesita cuentas)

| Pieza | Qué hace falta | Dónde se conecta |
|---|---|---|
| Claude en lugar de Gemini | Clave de la API de Anthropic con medio de pago | Reemplazar los nodos *Gemini*, *Gemini respaldo* y *Gemini extractor* por *Anthropic Chat Model* |
| HubSpot (RF-07) | Cuenta de HubSpot + token de *Private App* | Nodo HubSpot después de *Armar lead*, solo si `lead.integraciones.hubspot.crear` es verdadero. Los campos ya vienen armados en `lead.integraciones.hubspot` |
| Correo al consultor (RF-08) | Cuenta SMTP (o Gmail) y `QUIXA_CORREO_CONSULTOR` | Nodo *Send Email* con `lead.integraciones.correo.asunto` y `.html` |
| Agenda (RF-06) | Decidir Google Calendar o Cal.com y el umbral de puntaje | Enlace en el mensaje de despedida |
| Memoria en Postgres | Credencial de Postgres en n8n | Cambiar el nodo *Memoria* por *Postgres Chat Memory* (la conversación sobrevive a reinicios) |

En HubSpot hay que crear antes las propiedades personalizadas que empiezan por `quixa_` (lista en `lead.integraciones.hubspot`).
