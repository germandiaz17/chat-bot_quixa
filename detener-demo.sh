#!/usr/bin/env bash
cd "$(dirname "$0")"

parar() {
  local pidfile="$1" nombre="$2"
  if [ -f "$pidfile" ]; then
    local pid; pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      pkill -P "$pid" 2>/dev/null
      kill "$pid" 2>/dev/null
      echo "✓ $nombre detenido"
    fi
    rm -f "$pidfile"
  fi
}

esperar_puerto_libre() {
  local puerto="$1" nombre="$2"
  for i in $(seq 1 40); do
    curl -sf -o /dev/null -m 1 "http://localhost:$puerto/" 2>/dev/null || return 0
    read -t 0.5 -u 3 2>/dev/null || true
  done 3< /dev/null
  echo "⚠ el puerto $puerto ($nombre) sigue ocupado"
}

parar .web.pid "servidor web"
parar .n8n.pid "n8n"
esperar_puerto_libre 8080 "servidor web"
esperar_puerto_libre 5678 "n8n"
echo "✓ todo detenido"
exit 0
