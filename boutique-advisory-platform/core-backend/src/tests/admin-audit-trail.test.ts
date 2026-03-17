import test from 'node:test';
import assert from 'node:assert';
import { authorize, clearAuditLogs, getAuditLogs, AuthenticatedRequest } from '../middleware/authorize';

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
    }
  };
  return res;
}

test('Admin audit trail logs denied privileged action attempts', async () => {
  clearAuditLogs();

  const middleware = authorize('admin.user_manage');
  const req = {
    user: {
      id: 'user-investor',
      role: 'INVESTOR',
      tenantId: 'tenant-a',
      email: 'investor@test.com'
    },
    params: {},
    body: {},
    ip: '127.0.0.1',
    get: () => 'node-test'
  } as unknown as AuthenticatedRequest;
  const res = createMockRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 403);

  const logs = getAuditLogs();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].result, 'denied');
  assert.strictEqual(logs[0].permission, 'admin.user_manage');
  assert.strictEqual(logs[0].userRole, 'INVESTOR');
});

test('Admin audit trail can log allowed checks when enabled', async () => {
  clearAuditLogs();

  const middleware = authorize('admin.user_manage', { logAllChecks: true });
  const req = {
    user: {
      id: 'user-admin',
      role: 'ADMIN',
      tenantId: 'tenant-a',
      email: 'admin@test.com'
    },
    params: {},
    body: {},
    ip: '127.0.0.1',
    get: () => 'node-test'
  } as unknown as AuthenticatedRequest;
  const res = createMockRes();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, 200);

  const logs = getAuditLogs();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].result, 'allowed');
  assert.strictEqual(logs[0].permission, 'admin.user_manage');
  assert.strictEqual(logs[0].userRole, 'ADMIN');
});
