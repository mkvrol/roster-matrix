#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ──────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="${DB_NAME:-contract_intel}"

echo "💾 Starting database backup..."

# Parse DATABASE_URL or use individual vars
if [ -n "${DATABASE_URL:-}" ]; then
  PROTO="$(echo "$DATABASE_URL" | grep :// | sed -e 's,^\(.*://\).*,\1,g')"
  URL="$(echo "${DATABASE_URL/$PROTO/}")"
  USERPASS="$(echo "$URL" | grep @ | cut -d@ -f1)"
  HOSTPORT="$(echo "${URL/$USERPASS@/}" | cut -d/ -f1)"
  DB_HOST="$(echo "$HOSTPORT" | cut -d: -f1)"
  DB_PORT="$(echo "$HOSTPORT" | cut -d: -f2)"
  DB_USER="$(echo "$USERPASS" | cut -d: -f1)"
  DB_PASS="$(echo "$USERPASS" | cut -d: -f2)"
  DB_NAME="$(echo "$URL" | grep / | cut -d/ -f2 | cut -d? -f1)"
else
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5432}"
  DB_USER="${DB_USER:-contract_intel}"
  DB_PASS="${DB_PASS:-}"
fi

BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "  Host: $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  Output: $BACKUP_FILE"

PGPASSWORD="$DB_PASS" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --format=plain \
  | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ Backup complete: $BACKUP_FILE ($SIZE)"

echo "🧹 Cleaning old backups (keeping last 30)..."
ls -t "$BACKUP_DIR"/${DB_NAME}_*.sql.gz 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true
echo "✅ Cleanup complete"
