import test from 'node:test';
import assert from 'node:assert';
import {
  authorize,
  authorizeAny,
  authorizeAll,
  requireOwnership,
  type AuthenticatedRequest,
} from '../middleware/authorize';

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function createReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    user: {
      id: 'user-1',
      role: 'INVESTOR',
      tenantId: 'tenant-a',
      email: 'user@test.com',
    },
    params: {},
    body: {},
    ip: '127.0.0.1',
    get: () => 'node-test',
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

test('Authorize middleware - returns 401 for unauthenticated requests', async () => {
  const middleware = authorize('investor.read');
  const req = createReq({ user: undefined });
  const res = createMockRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.code, 'AUTH_REQUIRED');
});

test('Authorize middleware - owner-based permission passes when owner id matches', async () => {
  const middleware = authorize('investor.read', { ownerIdParam: 'ownerId' });
  const req = createReq({
    user: {
      id: 'investor-1',
      role: 'INVESTOR',
      tenantId: 'tenant-a',
      email: 'investor@test.com',
    },
    params: { ownerId: 'investor-1' },
  });
  const res = createMockRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, 200);
});

test('authorizeAny - grants access when at least one permission matches', async () => {
  const middleware = authorizeAny(['admin.system_config', 'deal.create']);
  const req = createReq({
    user: {
      id: 'investor-1',
      role: 'INVESTOR',
      tenantId: 'tenant-a',
      email: 'investor@test.com',
    },
  });
  const res = createMockRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, 200);
});

test('authorizeAll - denies access when one permission is missing', async () => {
  const middleware = authorizeAll(['deal.create', 'admin.system_config']);
  const req = createReq({
    user: {
      id: 'investor-1',
      role: 'INVESTOR',
      tenantId: 'tenant-a',
      email: 'investor@test.com',
    },
  });
  const res = createMockRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 403);
  assert.deepStrictEqual(res.body.missing, ['admin.system_config']);
});

test('requireOwnership - admin bypasses ownership requirement', async () => {
  const middleware = requireOwnership('userId');
  const req = createReq({
    user: {
      id: 'admin-1',
      role: 'ADMIN',
      tenantId: 'tenant-a',
      email: 'admin@test.com',
    },
    body: { userId: 'someone-else' },
  });
  const res = createMockRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, 200);
});

test('requireOwnership - non-admin user cannot modify another user resource', async () => {
  const middleware = requireOwnership('userId');
  const req = createReq({
    user: {
      id: 'investor-1',
      role: 'INVESTOR',
      tenantId: 'tenant-a',
      email: 'investor@test.com',
    },
    body: { userId: 'investor-2' },
  });
  const res = createMockRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.code, 'OWNERSHIP_REQUIRED');
});
