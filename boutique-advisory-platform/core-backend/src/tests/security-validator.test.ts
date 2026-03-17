import test from 'node:test';
import assert from 'node:assert';
import { validateSecurityConfiguration } from '../utils/securityValidator';

const SECURITY_ENV_KEYS = [
  'NODE_ENV',
  'JWT_SECRET',
  'DATABASE_URL',
  'ENCRYPTION_KEY',
  'SERVICE_MODE',
  'TRADING_FRONTEND_URL',
  'FRONTEND_URL',
  'CORE_SSO_CONSUME_URL',
  'SSO_INTERNAL_API_KEY',
] as const;

function withEnv(overrides: Partial<Record<(typeof SECURITY_ENV_KEYS)[number], string>>, fn: () => void): void {
  const snapshot: Partial<Record<(typeof SECURITY_ENV_KEYS)[number], string | undefined>> = {};
  for (const key of SECURITY_ENV_KEYS) {
    snapshot[key] = process.env[key];
  }

  try {
    for (const key of SECURITY_ENV_KEYS) {
      delete process.env[key];
    }
    for (const [key, value] of Object.entries(overrides)) {
      process.env[key] = value;
    }
    fn();
  } finally {
    for (const key of SECURITY_ENV_KEYS) {
      const previous = snapshot[key];
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
  }
}

test('Security validator - blocks production startup when trading frontend URL uses internal hostname', () => {
  withEnv(
    {
      NODE_ENV: 'production',
      JWT_SECRET: 'Aq9Lm2Np4Rs8Ty1Uz6Wm3Cd5Ef0Gh7Jk',
      DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/bia?sslmode=require',
      ENCRYPTION_KEY: 'prod_encrypt_key_9VxA2Qn7Lp4Rs8Ty1Uz6Wm3',
      SERVICE_MODE: 'trading',
      TRADING_FRONTEND_URL: 'https://trade.railway.internal',
      CORE_SSO_CONSUME_URL: 'http://backend.railway.internal:8080/api/auth/sso/trading/consume',
      SSO_INTERNAL_API_KEY: 'sso_internal_key_9VxA2Qn7Lp4Rs8Ty1Uz6Wm3',
    },
    () => {
      const result = validateSecurityConfiguration();
      assert.strictEqual(result.success, false);
      assert.ok(result.results.some((item) =>
        item.name === 'Platform Boundary' && !item.passed && item.severity === 'CRITICAL'
      ));
    }
  );
});

test('Security validator - passes production startup with valid trading boundary config', () => {
  withEnv(
    {
      NODE_ENV: 'production',
      JWT_SECRET: 'Aq9Lm2Np4Rs8Ty1Uz6Wm3Cd5Ef0Gh7Jk',
      DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/bia?sslmode=require',
      ENCRYPTION_KEY: 'prod_encrypt_key_9VxA2Qn7Lp4Rs8Ty1Uz6Wm3',
      SERVICE_MODE: 'trading',
      TRADING_FRONTEND_URL: 'https://trade.cambobia.com',
      CORE_SSO_CONSUME_URL: 'https://api.cambobia.com/api/auth/sso/trading/consume',
      SSO_INTERNAL_API_KEY: 'sso_internal_key_9VxA2Qn7Lp4Rs8Ty1Uz6Wm3',
    },
    () => {
      const result = validateSecurityConfiguration();
      assert.strictEqual(result.success, true);
    }
  );
});
