import crypto from 'crypto';
import { prisma } from '../database';
import { encrypt, decrypt } from '../utils/encryption';

export type AbacEffect = 'ALLOW' | 'DENY';

export type AbacCondition = {
  field: string;
  op: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'gte' | 'lte' | 'exists';
  value?: any;
};

export type AbacPolicyConfig = {
  conditions: AbacCondition[];
  description?: string;
};

export type AbacPolicyInput = {
  name: string;
  resource: string;
  action: string;
  effect: AbacEffect;
  priority: number;
  enabled: boolean;
  config: AbacPolicyConfig;
};

function getHmacKey(): string {
  return process.env.ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000';
}

function computeHash(plainText: string): string {
  return crypto.createHmac('sha256', getHmacKey()).update(plainText).digest('hex');
}

function normalizeConditions(conditions: AbacCondition[]): AbacCondition[] {
  if (!Array.isArray(conditions)) return [];
  return conditions
    .map((condition) => ({
      field: String(condition.field || '').trim(),
      op: condition.op || 'equals',
      value: condition.value
    }))
    .filter((condition) => condition.field.length > 0);
}

function serializeConfig(config: AbacPolicyConfig): string {
  return JSON.stringify({
    conditions: normalizeConditions(config.conditions || []),
    description: config.description ? String(config.description).trim() : undefined
  });
}

function deserializeConfig(payload: string): AbacPolicyConfig {
  const parsed = JSON.parse(payload || '{}');
  return {
    conditions: normalizeConditions(parsed.conditions || []),
    description: parsed.description ? String(parsed.description).trim() : undefined
  };
}

export async function listAbacPolicies(tenantId: string) {
  const records = await prisma.abacPolicy.findMany({
    where: { tenantId },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
  });

  return records.map((record) => {
    const decrypted = decrypt(record.encryptedConfig);
    const hash = computeHash(decrypted);
    if (hash !== record.configHash) {
      throw new Error('ABAC policy config integrity check failed');
    }
    return { policy: record, config: deserializeConfig(decrypted) };
  });
}

export async function upsertAbacPolicy(params: {
  tenantId: string;
  id?: string;
  input: AbacPolicyInput;
  updatedBy?: string | null;
}) {
  const plain = serializeConfig(params.input.config);
  const encryptedConfig = encrypt(plain);
  const configHash = computeHash(plain);

  const data = {
    tenantId: params.tenantId,
    name: params.input.name.trim(),
    resource: params.input.resource.trim(),
    action: params.input.action.trim(),
    effect: params.input.effect,
    priority: params.input.priority,
    enabled: params.input.enabled,
    encryptedConfig,
    configHash,
    updatedBy: params.updatedBy || null
  };

  const record = params.id
    ? await prisma.abacPolicy.update({ where: { id: params.id }, data })
    : await prisma.abacPolicy.create({ data });

  return { policy: record, config: deserializeConfig(plain) };
}

export async function resolveAbacPoliciesForPermission(params: {
  tenantId: string;
  resource: string;
  action: string;
}) {
  const records = await prisma.abacPolicy.findMany({
    where: {
      tenantId: params.tenantId,
      enabled: true,
      resource: { in: [params.resource, '*'] },
      action: { in: [params.action, '*'] }
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
  });

  return records.map((record) => {
    const decrypted = decrypt(record.encryptedConfig);
    const hash = computeHash(decrypted);
    if (hash !== record.configHash) {
      throw new Error('ABAC policy config integrity check failed');
    }
    return { policy: record, config: deserializeConfig(decrypted) };
  });
}

export type AbacEvaluationResult = {
  hasPolicies: boolean;
  allowed: boolean;
  matchedPolicyId?: string;
  matchedEffect?: AbacEffect;
};

export function evaluateAbacPolicies(policies: Array<{ policy: any; config: AbacPolicyConfig }>, attributes: Record<string, any>): AbacEvaluationResult {
  if (!policies.length) {
    return { hasPolicies: false, allowed: true };
  }

  for (const { policy, config } of policies) {
    const matches = config.conditions.every((condition) => evaluateCondition(condition, attributes));
    if (!matches) continue;

    if (policy.effect === 'DENY') {
      return { hasPolicies: true, allowed: false, matchedPolicyId: policy.id, matchedEffect: 'DENY' };
    }

    if (policy.effect === 'ALLOW') {
      return { hasPolicies: true, allowed: true, matchedPolicyId: policy.id, matchedEffect: 'ALLOW' };
    }
  }

  return { hasPolicies: true, allowed: false };
}

function evaluateCondition(condition: AbacCondition, attributes: Record<string, any>): boolean {
  const value = getAttributeValue(attributes, condition.field);
  const op = condition.op || 'equals';
  const target = condition.value;

  switch (op) {
    case 'exists':
      return value !== undefined && value !== null;
    case 'equals':
      return value === target;
    case 'not_equals':
      return value !== target;
    case 'in':
      return Array.isArray(target) ? target.includes(value) : false;
    case 'not_in':
      return Array.isArray(target) ? !target.includes(value) : false;
    case 'contains':
      if (Array.isArray(value)) {
        return value.includes(target);
      }
      if (typeof value === 'string') {
        return typeof target === 'string' ? value.includes(target) : false;
      }
      return false;
    case 'gte':
      return typeof value === 'number' && typeof target === 'number' ? value >= target : false;
    case 'lte':
      return typeof value === 'number' && typeof target === 'number' ? value <= target : false;
    default:
      return false;
  }
}

function getAttributeValue(attributes: Record<string, any>, field: string): any {
  const path = field.split('.').filter(Boolean);
  let cursor: any = attributes;
  for (const segment of path) {
    if (cursor && Object.prototype.hasOwnProperty.call(cursor, segment)) {
      cursor = cursor[segment];
    } else {
      return undefined;
    }
  }
  return cursor;
}
