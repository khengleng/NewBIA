import test from 'node:test';
import assert from 'node:assert';
import { getTenantId } from '../utils/tenant-utils';

type MinimalReq = {
  hostname?: string;
  headers: Record<string, string | undefined>;
};

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  }
}

test('Tenant resolution - production uses hostname and ignores x-tenant-id', () => {
  withEnv({ NODE_ENV: 'production' }, () => {
    const req = {
      hostname: 'tenant1.cambobia.com',
      headers: { 'x-tenant-id': 'attacker-tenant' },
    } as unknown as MinimalReq;

    const tenantId = getTenantId(req as any);
    assert.strictEqual(tenantId, 'tenant1');
  });
});

test('Tenant resolution - local/railway host falls back to default in production', () => {
  withEnv({ NODE_ENV: 'production', CORE_TENANT_ID: 'default', TRADING_TENANT_ID: 'trade' }, () => {
    const railwayReq = {
      hostname: 'my-app.up.railway.app',
      headers: {},
    } as unknown as MinimalReq;
    assert.strictEqual(getTenantId(railwayReq as any), 'default');

    const localhostReq = {
      hostname: 'localhost',
      headers: {},
    } as unknown as MinimalReq;
    assert.strictEqual(getTenantId(localhostReq as any), 'default');

    const coreHostReq = {
      hostname: 'www.cambobia.com',
      headers: {},
    } as unknown as MinimalReq;
    assert.strictEqual(getTenantId(coreHostReq as any), 'default');

    const tradingHostReq = {
      hostname: 'trade.cambobia.com',
      headers: {},
    } as unknown as MinimalReq;
    assert.strictEqual(getTenantId(tradingHostReq as any), 'trade');
  });
});

test('Tenant resolution - forwarded host chain prefers public Cambobia host', () => {
  withEnv({ NODE_ENV: 'production', CORE_TENANT_ID: 'default', TRADING_TENANT_ID: 'trade' }, () => {
    const req = {
      hostname: 'backend-production-9d40.up.railway.app',
      headers: {
        'x-forwarded-host': 'backend-production-9d40.up.railway.app, www.cambobia.com',
        host: 'backend-production-9d40.up.railway.app',
      },
    } as unknown as MinimalReq;

    assert.strictEqual(getTenantId(req as any), 'default');
  });
});

test('Tenant resolution - forwarded host chain prefers public trading host', () => {
  withEnv({ NODE_ENV: 'production', CORE_TENANT_ID: 'default', TRADING_TENANT_ID: 'trade' }, () => {
    const req = {
      hostname: 'trading-production.up.railway.app',
      headers: {
        'x-forwarded-host': 'trading-production.up.railway.app, trade.cambobia.com',
        host: 'trading-production.up.railway.app',
      },
    } as unknown as MinimalReq;

    assert.strictEqual(getTenantId(req as any), 'trade');
  });
});

test('Tenant resolution - internal and IP hosts fall back to core tenant in production', () => {
  withEnv({ NODE_ENV: 'production', CORE_TENANT_ID: 'default', TRADING_TENANT_ID: 'trade' }, () => {
    const internalReq = {
      hostname: '0.0.0.0',
      headers: {
        'x-forwarded-host': '0.0.0.0:8080',
        host: 'backend.railway.internal:8080',
      },
    } as unknown as MinimalReq;

    assert.strictEqual(getTenantId(internalReq as any), 'default');
  });
});

test('Tenant resolution - development can use x-tenant-id override', () => {
  withEnv({ NODE_ENV: 'development' }, () => {
    const req = {
      hostname: 'localhost',
      headers: { 'x-tenant-id': 'dev-tenant' },
    } as unknown as MinimalReq;

    assert.strictEqual(getTenantId(req as any), 'dev-tenant');
  });
});

test('Tenant resolution - production ignores forged x-forwarded-host when host is public', () => {
  withEnv({ NODE_ENV: 'production', CORE_TENANT_ID: 'default' }, () => {
    const req = {
      hostname: 'www.cambobia.com',
      headers: {
        host: 'www.cambobia.com',
        'x-forwarded-host': 'attacker.cambobia.com',
      },
    } as unknown as MinimalReq;

    assert.strictEqual(getTenantId(req as any), 'default');
  });
});
