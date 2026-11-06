#!/usr/bin/env bash
# Cambia la clave de Gemini en .env y en la credencial de n8n, y reinicia la demo.
# Uso:  ./cambiar-clave-gemini.sh            en una terminal: pide la clave sin mostrarla
#                                            sin terminal: usa la que pusiste en .env (GEMINI_API_KEY=...)
#       ./cambiar-clave-gemini.sh AIza...    la toma del argumento
# Clave nueva: https://aistudio.google.com/apikey
cd "$(dirname "$0")"
set -e
CLAVE="$1"
if [ -z "$CLAVE" ]; then
  if [ -t 0 ]; then read -rsp "Pega la clave nueva de Gemini: " CLAVE || true; echo
  else CLAVE=$(grep -m1 '^GEMINI_API_KEY=' .env | cut -d= -f2- | tr -d '"\r '); echo "· usando la clave de .env"; fi
fi
[ ${#CLAVE} -ge 30 ] || { echo "✗ La clave está vacía o incompleta"; exit 1; }   # formatos: AIza... (antiguo) o AQ. (nuevo)

# 1. Probar la clave antes de tocar nada
COD=$(curl -s -o /dev/null -w '%{http_code}' -H "x-goog-api-key: $CLAVE" \
  "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1")
[ "$COD" = "200" ] || { echo "✗ Google rechazó la clave (HTTP $COD). No se cambió nada."; exit 1; }
echo "✓ clave válida"

# 2. Guardarla en .env
sed -i "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=$CLAVE|" .env

# 3. Reemplazar la credencial de n8n (mismo id, los nodos no cambian)
./detener-demo.sh > /dev/null
TMP=.n8n-data/credencial-gemini.json
umask 077
cat > "$TMP" <<JSON
[{"id":"RuZqi192vXNISAgi","name":"Gemini QUIXA Demo","type":"googlePalmApi",
  "data":{"host":"https://generativelanguage.googleapis.com","apiKey":"$CLAVE"}}]
JSON
N8N_USER_FOLDER="$(pwd)/.n8n-data" ./node_modules/.bin/n8n import:credentials --input="$TMP" 2>&1 | grep -iE "import|error" || true
rm -f "$TMP"
echo "✓ credencial de n8n actualizada"

# 4. Volver a levantar
./iniciar-demo.sh
