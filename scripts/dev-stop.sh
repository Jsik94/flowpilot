#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT_DIR/.flowpilot/pids"
source "$ROOT_DIR/scripts/dev-env.sh"

FRONTEND_ENV_FILE="$(resolve_env_file "$ROOT_DIR/frontend")"
BACKEND_ENV_FILE="$(resolve_env_file "$ROOT_DIR/backend")"
FRONTEND_PORT="$(read_env_value "$FRONTEND_ENV_FILE" "PORT" "5173")"
BACKEND_PORT="$(read_env_value "$BACKEND_ENV_FILE" "PORT" "3001")"

stop_service() {
  local name="$1"
  local pid_file="$PID_DIR/$name.pid"

  if [[ ! -f "$pid_file" ]]; then
    echo "$name is not running"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"

  if kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true
    echo "stopped $name (pid: $pid)"
  else
    echo "$name pid file existed, but process was not running"
  fi

  rm -f "$pid_file"
}

stop_port_listener() {
  local name="$1"
  local port="$2"
  local pids

  pids="$(lsof -t -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"

  if [[ -z "$pids" ]]; then
    return
  fi

  for pid in $pids; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      echo "stopped $name listener on port $port (pid: $pid)"
    fi
  done
}

stop_service "frontend"
stop_service "backend"
stop_port_listener "frontend" "$FRONTEND_PORT"
stop_port_listener "backend" "$BACKEND_PORT"
