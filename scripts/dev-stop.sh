#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT_DIR/.flowpilot/pids"

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
stop_port_listener "frontend" 5173
stop_port_listener "backend" 3001
