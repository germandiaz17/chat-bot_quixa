#!/usr/bin/env bash
# Arranca la demo completa de QUIXA: n8n + flujo activo + servidor web.
cd "$(dirname "$0")"

AZUL='\033[1;34m'; VERDE='\033[1;32m'; AMAR='\033[1;33m'; ROJO='\033[1;31m'; OFF='\033[0m'
set -a; . ./.env; set +a

echo -e "${AZUL}▸ QUIXA · Consultor Virtual — demo local${OFF}\n"

vivo_n8n() { curl -sf -o /dev/null -m 4 http://localhost:5678/healthz 2>/dev/null; }
vivo_web()  { curl -sf -o /dev/null -m 4 http://localhost:8080/ 2>/dev/null; }

# 1. n8n
if vivo_n8n; then
  echo -e "  ${VERDE}✓${OFF} n8n ya estaba corriendo"
else
  echo -n "  Arrancando n8n (la primera vez tarda ~40s)... "
  ./start-n8n.sh > n8n.log 2>&1 &
  echo $! > .n8n.pid
  if curl -sf -o /dev/null --retry 60 --retry-delay 3 --retry-connrefused --retry-all-errors -m 300 http://localhost:5678/healthz; then
    echo -e "${VERDE}listo${OFF}"
  else
    echo -e "${ROJO}FALLÓ${OFF} — revisa n8n.log"; exit 1
  fi
fi

# 2. Activar el flujo (tras cada reinicio hace falta)
echo -n "  Activando el flujo del consultor... "
# La API publica de n8n tarda unos segundos mas que healthz en quedar lista.
COD=000
for intento in $(seq 1 20); do
  COD=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "http://localhost:5678/api/v1/workflows/$N8N_WORKFLOW_ID/activate")
  [ "$COD" = "200" ] && break
  curl -s -o /dev/null -m 2 "http://localhost:5678/healthz"
done
if [ "$COD" = "200" ]; then echo -e "${VERDE}listo${OFF}"; else echo -e "${ROJO}error HTTP $COD${OFF}"; fi

# 3. Comprobar que el webhook responde de verdad
echo -n "  Probando el webhook... "
RESP=$(curl -s -m 70 -X POST http://localhost:5678/webhook/chat \
  -H 'Content-Type: application/json' -d '{"sessionId":"healthcheck","message":"__INICIO__"}')
if echo "$RESP" | grep -q '"reply"'; then
  echo -e "${VERDE}responde${OFF}"
else
  echo -e "${AMAR}sin respuesta${OFF}"
  echo "     $(echo "$RESP" | head -c 160)"
  echo -e "     ${AMAR}Causa más probable: cuota de Gemini agotada (15 peticiones/minuto). Espera un minuto.${OFF}"
fi

# 4. Servidor web
if vivo_web; then
  echo -e "  ${VERDE}✓${OFF} servidor web ya estaba corriendo"
else
  echo -n "  Arrancando servidor web... "
  node servidor-demo.js > servidor.log 2>&1 &
  echo $! > .web.pid
  curl -sf -o /dev/null --retry 25 --retry-delay 1 --retry-connrefused -m 30 http://localhost:8080/ \
    && echo -e "${VERDE}listo${OFF}" || echo -e "${ROJO}falló${OFF}"
fi

echo
echo -e "  ${AZUL}Sitio de QUIXA${OFF}   http://localhost:8080"
echo -e "  ${AZUL}Leads captados${OFF}   http://localhost:8080/leads.html"
echo -e "  ${AZUL}Flujo en n8n${OFF}     http://localhost:5678"
echo -e "                   usuario: $N8N_EMAIL   clave: $N8N_PASSWORD"
echo
echo -e "  Detener todo:  ${AMAR}./detener-demo.sh${OFF}"
echo
