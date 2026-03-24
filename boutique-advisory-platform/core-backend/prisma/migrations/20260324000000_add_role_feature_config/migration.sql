CREATE TABLE IF NOT EXISTS "role_feature_configs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "encryptedConfig" TEXT NOT NULL,
  "configHash" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "role_feature_configs_tenantId_role_key" ON "role_feature_configs"("tenantId", "role");
CREATE INDEX IF NOT EXISTS "role_feature_configs_tenantId_role_idx" ON "role_feature_configs"("tenantId", "role");

ALTER TABLE "role_feature_configs"
  ADD CONSTRAINT "role_feature_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_feature_configs"
  ADD CONSTRAINT "role_feature_configs_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
