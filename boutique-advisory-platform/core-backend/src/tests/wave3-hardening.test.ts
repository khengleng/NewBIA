import test, { after } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import authRouter from '../routes/auth';
import communityRouter from '../routes/community';
import { verifySocketAuthToken } from '../socket';
import { prisma } from '../database';
import redis from '../redis';

type MockRequest = {
  method: string;
  url: string;
  params: Record<string, string>;
  body?: any;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  user?: any;
  ip?: string;
  socket?: { remoteAddress?: string };
  get: (name: string) => string | undefined;
};

type MockResponse = {
  statusCode: number;
  payload: any;
  ended: boolean;
  status: (code: number) => MockResponse;
  json: (body: any) => MockResponse;
  send: (body: any) => MockResponse;
};

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    payload: undefined,
    ended: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.payload = body;
      this.ended = true;
      return this;
    },
    send(body: any) {
      this.payload = body;
      this.ended = true;
      return this;
    },
  };
}

async function invokeRoute(
  router: Router,
  method: string,
  routePath: string,
  req: Omit<MockRequest, 'method' | 'url' | 'get'>
): Promise<MockResponse> {
  const layer = (router as any).stack.find(
    (l: any) => l.route?.path === routePath && l.route?.methods?.[method.toLowerCase()] === true
  );
  if (!layer) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${routePath}`);
  }

  const headers = req.headers || {};
  const request: MockRequest = {
    method: method.toUpperCase(),
    url: routePath,
    get: (name: string) => headers[name.toLowerCase()] || headers[name],
    ...req,
    headers,
    cookies: req.cookies || {},
  };
  const response = createMockResponse();

  for (const stackItem of layer.route.stack) {
    if (response.ended) break;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = (err?: unknown) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };

      try {
        const result = stackItem.handle(request, response, done);
        if (result && typeof result.then === 'function') {
          result.then(() => done()).catch(done);
        } else if (stackItem.handle.length < 3) {
          done();
        }
      } catch (error) {
        done(error);
      }
    });
  }

  return response;
}

test('Wave3 - switch-role rejects pre-auth token', async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'wave3-secret-key-1234567890-abcdefghijklmnopqrstuvwxyz';

  try {
    const preAuthToken = jwt.sign(
      { userId: 'user-1', role: 'INVESTOR', tenantId: 'tenant-a', isPreAuth: true },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    const response = await invokeRoute(authRouter, 'post', '/switch-role', {
      params: {},
      body: { targetRole: 'SME' },
      headers: { authorization: `Bearer ${preAuthToken}` },
      cookies: {},
      socket: { remoteAddress: '127.0.0.1' },
      ip: '127.0.0.1',
    });

    assert.strictEqual(response.statusCode, 401);
  } finally {
    process.env.JWT_SECRET = originalSecret;
  }
});

test('Wave3 - switch-role rejects operator role personas', async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalFindUnique = prisma.user.findUnique;
  const originalUpdate = prisma.user.update;
  process.env.JWT_SECRET = 'wave3-secret-key-1234567890-abcdefghijklmnopqrstuvwxyz';

  let updateCalled = false;

  (prisma.user.findUnique as any) = async () => ({
    id: 'admin-1',
    email: 'admin@cambobia.com',
    role: 'SUPER_ADMIN',
    tenantId: 'tenant-a',
    firstName: 'Admin',
    lastName: 'User',
    twoFactorEnabled: false,
    investor: null,
    sme: null,
  });
  (prisma.user.update as any) = async () => {
    updateCalled = true;
    return null;
  };

  try {
    const token = jwt.sign(
      { userId: 'admin-1', role: 'SUPER_ADMIN', tenantId: 'tenant-a' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    const response = await invokeRoute(authRouter, 'post', '/switch-role', {
      params: {},
      body: { targetRole: 'INVESTOR' },
      headers: { authorization: `Bearer ${token}` },
      cookies: {},
      socket: { remoteAddress: '127.0.0.1' },
      ip: '127.0.0.1',
    });

    assert.strictEqual(response.statusCode, 403);
    assert.strictEqual(updateCalled, false);
  } finally {
    process.env.JWT_SECRET = originalSecret;
    (prisma.user.findUnique as any) = originalFindUnique;
    (prisma.user.update as any) = originalUpdate;
  }
});

test('Wave3 - socket auth rejects pre-auth token', async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'wave3-secret-key-1234567890-abcdefghijklmnopqrstuvwxyz';

  try {
    const preAuthToken = jwt.sign(
      { userId: 'user-1', role: 'INVESTOR', tenantId: 'tenant-a', isPreAuth: true },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    assert.throws(() => verifySocketAuthToken(preAuthToken), /Two-factor authentication required/);
  } finally {
    process.env.JWT_SECRET = originalSecret;
  }
});

test('Wave3 - community create post uses caller tenant scope', async () => {
  const originalCreate = prisma.communityPost.create;
  let capturedTenantId = '';

  (prisma.communityPost.create as any) = async ({ data }: any) => {
    capturedTenantId = data.tenantId;
    return { id: 'post-1', ...data };
  };

  try {
    const response = await invokeRoute(communityRouter, 'post', '/posts', {
      params: {},
      body: { title: 'test', content: 'hello world' },
      user: {
        id: 'admin-1',
        role: 'SUPER_ADMIN',
        tenantId: 'tenant-z',
        email: 'admin@test.com',
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    });

    assert.strictEqual(response.statusCode, 201);
    assert.strictEqual(capturedTenantId, 'tenant-z');
  } finally {
    (prisma.communityPost.create as any) = originalCreate;
  }
});

after(() => {
  redis.disconnect();
});
