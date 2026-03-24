import crypto from 'crypto';
import { prisma } from '../database';
import { normalizeRole } from '../lib/roles';
import { getStaticPermissionsForRole, UserRole } from '../lib/permissions';
import { encrypt, decrypt } from '../utils/encryption';

export type RolePermissionMode = 'extend' | 'replace';

export type RolePermissionConfig = {
  mode: RolePermissionMode;
  permissions: string[];
};

function getHmacKey(): string {
  return process.env.ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000';
}

function computeHash(plainText: string): string {
  return crypto.createHmac('sha256', getHmacKey()).update(plainText).digest('hex');
}

function normalizePermissions(permissions: string[]): string[] {
  const cleaned = permissions
    .map((entry) => String(entry || '').trim())
    .filter((entry) => entry.length > 0);
  return Array.from(new Set(cleaned));
}

function serializeConfig(config: RolePermissionConfig): string {
  return JSON.stringify({
    mode: config.mode === 'extend' ? 'extend' : 'replace',
    permissions: normalizePermissions(config.permissions || [])
  });
}

function deserializeConfig(payload: string): RolePermissionConfig {
  const parsed = JSON.parse(payload);
  return {
    mode: parsed.mode === 'extend' ? 'extend' : 'replace',
    permissions: normalizePermissions(parsed.permissions || [])
  };
}

function getDefaultConfig(role: UserRole): RolePermissionConfig {
  return {
    mode: 'replace',
    permissions: getStaticPermissionsForRole(role)
  };
}

export async function getRolePermissionConfig(tenantId: string, role: string) {
  const normalized = normalizeRole(role) as UserRole | undefined;
  if (!normalized) {
    throw new Error('Invalid role');
  }

  const existing = await prisma.rolePermissionConfig.findUnique({
    where: { tenantId_role: { tenantId, role: normalized } }
  });

  if (!existing) {
    const defaults = getDefaultConfig(normalized);
    const plain = serializeConfig(defaults);
    const encryptedConfig = encrypt(plain);
    const configHash = computeHash(plain);

    const created = await prisma.rolePermissionConfig.create({
      data: {
        tenantId,
        role: normalized,
        encryptedConfig,
        configHash
      }
    });

    return { config: defaults, record: created };
  }

  const decrypted = decrypt(existing.encryptedConfig);
  const hash = computeHash(decrypted);
  if (hash !== existing.configHash) {
    throw new Error('Role permission config integrity check failed');
  }

  return { config: deserializeConfig(decrypted), record: existing };
}

export async function setRolePermissionConfig(params: {
  tenantId: string;
  role: string;
  config: RolePermissionConfig;
  updatedBy?: string | null;
}) {
  const normalized = normalizeRole(params.role) as UserRole | undefined;
  if (!normalized) {
    throw new Error('Invalid role');
  }

  const plain = serializeConfig(params.config);
  const encryptedConfig = encrypt(plain);
  const configHash = computeHash(plain);

  const record = await prisma.rolePermissionConfig.upsert({
    where: { tenantId_role: { tenantId: params.tenantId, role: normalized } },
    update: {
      encryptedConfig,
      configHash,
      updatedBy: params.updatedBy || null
    },
    create: {
      tenantId: params.tenantId,
      role: normalized,
      encryptedConfig,
      configHash,
      updatedBy: params.updatedBy || null
    }
  });

  return { config: deserializeConfig(plain), record };
}

export async function listRolePermissionConfigs(tenantId: string, roles: string[]) {
  const results: Array<{ role: string; config: RolePermissionConfig }> = [];

  for (const role of roles) {
    const { config } = await getRolePermissionConfig(tenantId, role);
    results.push({ role: normalizeRole(role) || role, config });
  }

  return results;
}

export function resolveEffectivePermissions(role: UserRole, config: RolePermissionConfig): string[] {
  if (config.mode === 'extend') {
    return normalizePermissions([...getStaticPermissionsForRole(role), ...config.permissions]);
  }
  return normalizePermissions(config.permissions);
}

export async function resolveRolePermissions(tenantId: string, role: string): Promise<string[]> {
  const normalized = normalizeRole(role) as UserRole | undefined;
  if (!normalized) return [];
  const { config } = await getRolePermissionConfig(tenantId, normalized);
  return resolveEffectivePermissions(normalized, config);
}
