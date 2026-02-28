#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$BACKEND_ROOT/docker/docker-compose.yml"

# MODE can be: push (default), deploy, reset
MODE="${MODE:-${1:-push}}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed or not in PATH."
  exit 1
fi

dc() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

echo "Starting containers (db, backend)..."
dc up -d db backend

echo "Prisma validate + generate (inside container)..."
dc exec -T backend sh -lc '
  set -e
  cd /app
  rm -rf node_modules/.prisma
  npx prisma validate
  npx prisma generate
'

echo "Sync database schema (mode=$MODE)..."
case "$MODE" in
  push)
    dc exec -T backend sh -lc '
      set -e
      cd /app
      npx prisma db push
    '
    ;;
  deploy)
    dc exec -T backend sh -lc '
      set -e
      cd /app
      npx prisma migrate deploy
    '
    ;;
  reset)
    dc exec -T backend sh -lc '
      set -e
      cd /app
      npx prisma migrate reset --force
    '
    ;;
  *)
    echo "ERROR: Unknown MODE=$MODE (use push|deploy|reset)."
    exit 1
    ;;
esac

echo "Running seed (inside container)..."
dc exec -T backend sh -lc '
  set -e
  cd /app
  if [ -f prisma/seeds/seed.js ]; then
    node prisma/seeds/seed.js
  else
    node prisma/seeds/ferraillage.seed.js
  fi
'

echo "Restarting backend..."
dc restart backend

echo "Done: Prisma generated, DB synced, and seed executed."
