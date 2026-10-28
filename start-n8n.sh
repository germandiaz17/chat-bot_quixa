#!/usr/bin/env bash
cd "$(dirname "$0")"
export N8N_PORT=5678
export N8N_HOST=localhost
export N8N_PROTOCOL=http
export WEBHOOK_URL=http://localhost:5678/
export N8N_SECURE_COOKIE=false
export N8N_DIAGNOSTICS_ENABLED=false
export N8N_VERSION_NOTIFICATIONS_ENABLED=false
export N8N_PERSONALIZATION_ENABLED=false
export N8N_RUNNERS_ENABLED=true
export N8N_BLOCK_ENV_ACCESS_IN_NODE=false
export N8N_RESTRICT_FILE_ACCESS_TO="$(pwd)/leads"
export N8N_BLOCK_FILE_ACCESS_TO_N8N_FILES=true
export N8N_USER_FOLDER="$(pwd)/.n8n-data"
exec ./node_modules/.bin/n8n start
