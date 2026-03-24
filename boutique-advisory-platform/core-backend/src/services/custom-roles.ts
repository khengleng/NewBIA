import crypto from 'crypto';
import { prisma } from '../database';
import { normalizeRole } from '../lib/roles';
import { encrypt, decrypt } from '../utils/encryption';

export type CustomRoleConfig = {
  code: string;
  name: string;
  baseRole: string;
  description?: string;
  permissions: string[];
  enabled: boolean;
};

function getHmacKey(): string {
  return process.env.ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000';
}

function computeHash(plainText: string): string {
  return crypto.createHmac('sha256', getHmacKey()).update(plainText).digest('hex');
}

export function normalizeCustomRoleCode(code: string): string {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_{2,}/g, '_');
}

function normalizePermissions(permissions: string[]): string[] {
  const cleaned = permissions
    .map((entry) => String(entry || '').trim())
    .filter((entry) => entry.length > 0);
  return Array.from(new Set(cleaned));
}

function serializeConfig(config: CustomRoleConfig): string {
  return JSON.stringify({
    code: normalizeCustomRoleCode(config.code),
    name: String(config.name || '').trim(),
    baseRole: String(config.baseRole || '').trim().toUpperCase(),
    description: config.description ? String(config.description).trim() : undefined,
    permissions: normalizePermissions(config.permissions || []),
    enabled: Boolean(config.enabled)
  });
}

function deserializeConfig(payload: string): CustomRoleConfig {
  const parsed = JSON.parse(payload);
  return {
    code: normalizeCustomRoleCode(parsed.code || ''),
    name: String(parsed.name || '').trim(),
    baseRole: String(parsed.baseRole || '').trim().toUpperCase(),
    description: parsed.description ? String(parsed.description).trim() : undefined,
    permissions: normalizePermissions(parsed.permissions || []),
    enabled: Boolean(parsed.enabled)
  };
}

export async function listCustomRoles(tenantId: string) {
  const records = await prisma.customRoleConfig.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' }
  });

  return records.map((record) => {
    const decrypted = decrypt(record.encryptedConfig);
    const hash = computeHash(decrypted);
    if (hash !== record.configHash) {
      throw new Error('Custom role config integrity check failed');
    }
    return { config: deserializeConfig(decrypted), record };
  });
}

export async function getCustomRole(tenantId: string, code: string) {
  const normalized = normalizeCustomRoleCode(code);
  if (!normalized) throw new Error('Invalid role code');

  const record = await prisma.customRoleConfig.findUnique({
    where: { tenantId_code: { tenantId, code: normalized } }
  });

  if (!record) return null;

  const decrypted = decrypt(record.encryptedConfig);
  const hash = computeHash(decrypted);
  if (hash !== record.configHash) {
    throw new Error('Custom role config integrity check failed');
  }

  return { config: deserializeConfig(decrypted), record };
}

export async function upsertCustomRole(params: {
  tenantId: string;
  config: CustomRoleConfig;
  updatedBy?: string | null;
}) {
  const normalized = normalizeCustomRoleCode(params.config.code);
  if (!normalized) throw new Error('Invalid role code');

  const plain = serializeConfig({ ...params.config, code: normalized });
  const encryptedConfig = encrypt(plain);
  const configHash = computeHash(plain);

  const record = await prisma.customRoleConfig.upsert({
    where: { tenantId_code: { tenantId: params.tenantId, code: normalized } },
    update: {
      encryptedConfig,
      configHash,
      updatedBy: params.updatedBy || null
    },
    create: {
      tenantId: params.tenantId,
      code: normalized,
      encryptedConfig,
      configHash,
      updatedBy: params.updatedBy || null
    }
  });

  return { config: deserializeConfig(plain), record };
}

export async function setUserCustomRoleAssignments(params: {
  tenantId: string;
  userId: string;
  roleCodes: string[];
  updatedBy?: string | null;
}) {
  const normalizedRoles = Array.from(new Set((params.roleCodes || []).map(normalizeCustomRoleCode)));
  const payload = JSON.stringify({ roleCodes: normalizedRoles });
  const encryptedConfig = encrypt(payload);
  const configHash = computeHash(payload);

  const record = await prisma.userCustomRoleAssignment.upsert({
    where: { tenantId_userId: { tenantId: params.tenantId, userId: params.userId } },
    update: {
      encryptedConfig,
      configHash,
      updatedBy: params.updatedBy || null
    },
    create: {
      tenantId: params.tenantId,
      userId: params.userId,
      encryptedConfig,
      configHash,
      updatedBy: params.updatedBy || null
    }
  });

  return { roleCodes: normalizedRoles, record };
}

export async function getUserCustomRoleAssignments(tenantId: string, userId: string) {
  const record = await prisma.userCustomRoleAssignment.findUnique({
    where: { tenantId_userId: { tenantId, userId } }
  });

  if (!record) return { roleCodes: [] as string[], record: null };

  const decrypted = decrypt(record.encryptedConfig);
  const hash = computeHash(decrypted);
  if (hash !== record.configHash) {
    throw new Error('Custom role assignment integrity check failed');
  }

  const payload = JSON.parse(decrypted || '{}');
  const roleCodes = Array.isArray(payload.roleCodes) ? payload.roleCodes.map(normalizeCustomRoleCode) : [];

  return { roleCodes: Array.from(new Set(roleCodes)), record };
}

export async function resolveUserCustomPermissions(params: {
  tenantId: string;
  userId: string;
  userRole?: string | null;
}) {
  const baseRole = normalizeRole(params.userRole || '') || '';
  const { roleCodes } = await getUserCustomRoleAssignments(params.tenantId, params.userId);
  if (roleCodes.length === 0) return [] as string[];

  const roleRecords = await prisma.customRoleConfig.findMany({
    where: {
      tenantId: params.tenantId,
      code: { in: roleCodes }
    }
  });

  const permissions: string[] = [];

  for (const record of roleRecords) {
    const decrypted = decrypt(record.encryptedConfig);
    const hash = computeHash(decrypted);
    if (hash !== record.configHash) {
      throw new Error('Custom role config integrity check failed');
    }
    const config = deserializeConfig(decrypted);
    if (!config.enabled) continue;

    const roleMatch = config.baseRole === 'ANY' || (baseRole && config.baseRole === baseRole);
    if (!roleMatch) continue;

    permissions.push(...config.permissions);
  }

  return Array.from(new Set(permissions.map((entry) => String(entry || '').trim()).filter((entry) => entry.length > 0)));
}
