-- Add role permission configs
CREATE TABLE IF NOT EXISTS "role_permission_configs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "encryptedConfig" TEXT NOT NULL,
  "configHash" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "role_permission_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "role_permission_configs_tenantId_role_key" ON "role_permission_configs"("tenantId", "role");
CREATE INDEX IF NOT EXISTS "role_permission_configs_tenantId_role_idx" ON "role_permission_configs"("tenantId", "role");

ALTER TABLE "role_permission_configs" ADD CONSTRAINT "role_permission_configs_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permission_configs" ADD CONSTRAINT "role_permission_configs_updatedBy_fkey"
  FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add custom role configs
CREATE TABLE IF NOT EXISTS "custom_role_configs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "encryptedConfig" TEXT NOT NULL,
  "configHash" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "custom_role_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "custom_role_configs_tenantId_code_key" ON "custom_role_configs"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "custom_role_configs_tenantId_code_idx" ON "custom_role_configs"("tenantId", "code");

ALTER TABLE "custom_role_configs" ADD CONSTRAINT "custom_role_configs_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "custom_role_configs" ADD CONSTRAINT "custom_role_configs_updatedBy_fkey"
  FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add user custom role assignments
CREATE TABLE IF NOT EXISTS "user_custom_role_assignments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "encryptedConfig" TEXT NOT NULL,
  "configHash" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_custom_role_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_custom_role_assignments_tenantId_userId_key" ON "user_custom_role_assignments"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "user_custom_role_assignments_tenantId_userId_idx" ON "user_custom_role_assignments"("tenantId", "userId");

ALTER TABLE "user_custom_role_assignments" ADD CONSTRAINT "user_custom_role_assignments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_custom_role_assignments" ADD CONSTRAINT "user_custom_role_assignments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_custom_role_assignments" ADD CONSTRAINT "user_custom_role_assignments_updatedBy_fkey"
  FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
