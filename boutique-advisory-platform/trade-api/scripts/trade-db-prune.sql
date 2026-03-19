-- Prune database to a single trade tenant.
-- Usage:
--   sed "s/__TRADE_TENANT_ID__/trade/g" scripts/trade-db-prune.sql | psql "$TARGET_DATABASE_URL"
\set ON_ERROR_STOP on

BEGIN;

-- Disable FK checks while we prune
SET session_replication_role = replica;

-- Delete rows for other tenants in any table with tenantId column
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE column_name = 'tenantId' AND table_schema = 'public'
  LOOP
    EXECUTE format('DELETE FROM %I.%I WHERE "tenantId" <> %L', r.table_schema, r.table_name, '__TRADE_TENANT_ID__');
  END LOOP;
END $$;

-- Delete rows for other tenants in tables with userId but no tenantId
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.table_schema, t.table_name
    FROM information_schema.columns t
    WHERE t.column_name = 'userId'
      AND t.table_schema = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = t.table_schema
          AND c.table_name = t.table_name
          AND c.column_name = 'tenantId'
      )
  LOOP
    EXECUTE format(
      'DELETE FROM %I.%I WHERE "userId" NOT IN (SELECT id FROM "users" WHERE "tenantId" = %L)',
      r.table_schema, r.table_name, '__TRADE_TENANT_ID__'
    );
  END LOOP;
END $$;

DELETE FROM tenants WHERE id <> '__TRADE_TENANT_ID__';

SET session_replication_role = origin;

COMMIT;

-- Optional sanity check
-- SELECT count(*) AS remaining_tenants FROM tenants;
