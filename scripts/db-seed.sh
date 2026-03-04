#!/usr/bin/env bash
set -euo pipefail

echo "🌱 Seeding database..."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL is not set"
  exit 1
fi

npx prisma generate
npx prisma db seed

echo "✅ Seed complete"
