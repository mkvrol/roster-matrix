#!/usr/bin/env bash
set -euo pipefail

echo "🔄 Running database migrations..."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL is not set"
  exit 1
fi

npx prisma migrate deploy

echo "✅ Migrations complete"
