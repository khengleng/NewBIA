import crypto from 'crypto';
import { prisma } from '../database';
import { normalizeRole } from '../lib/roles';
import { encrypt, decrypt } from '../utils/encryption';

export type RoleFeatureConfig = {
  walletEnabled: boolean;
  paymentEnabled: boolean;
};

const DEFAULT_FEATURES: Record<string, RoleFeatureConfig> = {
  SUPER_ADMIN: { walletEnabled: true, paymentEnabled: true },
  ADMIN: { walletEnabled: true, paymentEnabled: true },
  FINOPS: { walletEnabled: true, paymentEnabled: true },
  CX: { walletEnabled: true, paymentEnabled: true },
  AUDITOR: { walletEnabled: true, paymentEnabled: true },
  COMPLIANCE: { walletEnabled: true, paymentEnabled: true },
  ADVISOR: { walletEnabled: true, paymentEnabled: true },
  INVESTOR: { walletEnabled: true, paymentEnabled: true },
  SME: { walletEnabled: true, paymentEnabled: true },
  SUPPORT: { walletEnabled: false, paymentEnabled: false }
};

function getHmacKey(): string {
  return process.env.ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000';
}

function computeHash(plainText: string): string {
  return crypto.createHmac('sha256', getHmacKey()).update(plainText).digest('hex');
}

function serializeConfig(config: RoleFeatureConfig): string {
  return JSON.stringify({
    walletEnabled: !!config.walletEnabled,
    paymentEnabled: !!config.paymentEnabled
  });
}

function deserializeConfig(payload: string): RoleFeatureConfig {
  const parsed = JSON.parse(payload);
  return {
    walletEnabled: !!parsed.walletEnabled,
    paymentEnabled: !!parsed.paymentEnabled
  };
}

export function getDefaultRoleFeatureConfig(role: string | null | undefined): RoleFeatureConfig {
  const normalized = normalizeRole(role);
  if (!normalized) return { walletEnabled: false, paymentEnabled: false };
  return DEFAULT_FEATURES[normalized] || { walletEnabled: false, paymentEnabled: false };
}

export async function getRoleFeatureConfig(tenantId: string, role: string) {
  const normalized = normalizeRole(role);
  if (!normalized) throw new Error('Invalid role');

  const existing = await prisma.roleFeatureConfig.findUnique({
    where: { tenantId_role: { tenantId, role: normalized } }
  });

  if (!existing) {
    const defaults = getDefaultRoleFeatureConfig(normalized);
    const plain = serializeConfig(defaults);
    const encryptedConfig = encrypt(plain);
    const configHash = computeHash(plain);

    const created = await prisma.roleFeatureConfig.create({
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
    throw new Error('Role feature config integrity check failed');
  }

  return { config: deserializeConfig(decrypted), record: existing };
}

export async function setRoleFeatureConfig(params: {
  tenantId: string;
  role: string;
  config: RoleFeatureConfig;
  updatedBy?: string | null;
}) {
  const normalized = normalizeRole(params.role);
  if (!normalized) throw new Error('Invalid role');

  const plain = serializeConfig(params.config);
  const encryptedConfig = encrypt(plain);
  const configHash = computeHash(plain);

  const record = await prisma.roleFeatureConfig.upsert({
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

export async function listRoleFeatureConfigs(tenantId: string, roles: string[]) {
  const results: Array<{ role: string; config: RoleFeatureConfig }> = [];

  for (const role of roles) {
    const { config } = await getRoleFeatureConfig(tenantId, role);
    results.push({ role: normalizeRole(role) || role, config });
  }

  return results;
}

export class FeatureDisabledError extends Error {
  code = 'FEATURE_DISABLED';
}

export async function requireRoleFeature(params: {
  tenantId: string;
  role: string | null | undefined;
  feature: keyof RoleFeatureConfig;
}) {
  const { config } = await getRoleFeatureConfig(params.tenantId, params.role || '');
  if (!config[params.feature]) {
    throw new FeatureDisabledError(`Feature disabled for role: ${params.feature}`);
  }
}
