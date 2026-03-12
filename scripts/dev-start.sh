#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.flowpilot"
PID_DIR="$RUNTIME_DIR/pids"
LOG_DIR="$RUNTIME_DIR/logs"

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

ensure_port_free "frontend" 5173
ensure_port_free "backend" 3001

start_service "frontend" "pnpm --filter frontend dev"
start_service "backend" "pnpm --filter backend dev"

echo "logs:"
echo "  frontend -> $LOG_DIR/frontend.log"
echo "  backend  -> $LOG_DIR/backend.log"
