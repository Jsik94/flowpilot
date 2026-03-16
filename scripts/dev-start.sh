#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.flowpilot"
PID_DIR="$RUNTIME_DIR/pids"
LOG_DIR="$RUNTIME_DIR/logs"
source "$ROOT_DIR/scripts/dev-env.sh"

FRONTEND_ENV_FILE="$(resolve_env_file "$ROOT_DIR/frontend")"
BACKEND_ENV_FILE="$(resolve_env_file "$ROOT_DIR/backend")"
FRONTEND_PORT="$(read_env_value "$FRONTEND_ENV_FILE" "PORT" "5173")"
BACKEND_PORT="$(read_env_value "$BACKEND_ENV_FILE" "PORT" "3001")"

mkdir -p "$PID_DIR" "$LOG_DIR"

ensure_port_free() {
  local name="$1"
  local port="$2"

  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "cannot start $name: port $port is already in use"
    echo "run 'pnpm dev:stop' if it is a stale FlowPilot process"
    echo "or free the port manually if another app is using it"
    exit 1
  fi
}

start_service() {
  local name="$1"
  local command="$2"
  local pid_file="$PID_DIR/$name.pid"
  local log_file="$LOG_DIR/$name.log"

  if [[ -f "$pid_file" ]]; then
    local existing_pid
    existing_pid="$(cat "$pid_file")"

    if kill -0 "$existing_pid" >/dev/null 2>&1; then
      echo "$name is already running (pid: $existing_pid)"
      return
    fi

    rm -f "$pid_file"
  fi

  nohup bash -lc "cd \"$ROOT_DIR\" && $command" >"$log_file" 2>&1 &
  local pid=$!
  echo "$pid" >"$pid_file"
  echo "started $name (pid: $pid)"
}

ensure_port_free "frontend" "$FRONTEND_PORT"
ensure_port_free "backend" "$BACKEND_PORT"

start_service "frontend" "pnpm --filter frontend dev"
start_service "backend" "pnpm --filter backend dev"

echo "ports:"
echo "  frontend -> http://localhost:$FRONTEND_PORT"
echo "  backend  -> http://localhost:$BACKEND_PORT"
echo "logs:"
echo "  frontend -> $LOG_DIR/frontend.log"
echo "  backend  -> $LOG_DIR/backend.log"
