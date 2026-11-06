#!/usr/bin/env bash
# Copia de seguridad diaria (RNF-08): base de datos de n8n, flujos y leads. Conserva 14 días.
# Programar con cron:  15 3 * * *  /ruta/a/demo-quixa/despliegue/respaldo.sh >> /var/log/quixa-respaldo.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"
DESTINO="${DESTINO_RESPALDOS:-./respaldos}"
HOY=$(date +%F)
mkdir -p "$DESTINO/$HOY"

docker compose exec -T postgres pg_dump -U n8n -d n8n | gzip > "$DESTINO/$HOY/n8n-db.sql.gz"
docker compose exec -T n8n n8n export:workflow --all --output=/tmp/flujos.json > /dev/null
docker compose cp n8n:/tmp/flujos.json "$DESTINO/$HOY/flujos.json"
tar -czf "$DESTINO/$HOY/leads.tar.gz" -C ./datos leads

find "$DESTINO" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
echo "$(date -Is) respaldo listo en $DESTINO/$HOY"
