#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

docker compose up -d --build

echo "FlowPilot containers started."
echo "  frontend: http://localhost:8080"
echo "  backend : http://localhost:3001/api/health"
