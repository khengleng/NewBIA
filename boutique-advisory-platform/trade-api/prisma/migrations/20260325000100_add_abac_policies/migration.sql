CREATE TABLE IF NOT EXISTS "abac_policies" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "effect" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "encryptedConfig" TEXT NOT NULL,
  "configHash" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "abac_policies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "abac_policies_tenantId_resource_action_idx" ON "abac_policies"("tenantId", "resource", "action");

ALTER TABLE "abac_policies" ADD CONSTRAINT "abac_policies_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "abac_policies" ADD CONSTRAINT "abac_policies_updatedBy_fkey"
  FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
