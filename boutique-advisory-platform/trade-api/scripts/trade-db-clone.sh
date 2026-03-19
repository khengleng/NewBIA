#!/bin/sh
set -euo pipefail

: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL to the current database}" 
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL to the new trade database}" 
: "${TRADE_TENANT_ID:?Set TRADE_TENANT_ID to the trade tenant id}" 

# Clone schema + data from source to target
pg_dump --no-owner --no-privileges "$SOURCE_DATABASE_URL" | psql "$TARGET_DATABASE_URL"

# Prune everything except the trade tenant
psql "$TARGET_DATABASE_URL" -v TRADE_TENANT_ID="$TRADE_TENANT_ID" -f /Users/mlh/NewBIA/boutique-advisory-platform/trade-api/scripts/trade-db-prune.sql

echo "Clone + prune complete."
