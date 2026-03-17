import test from 'node:test';
import assert from 'node:assert';
import { Router } from 'express';
import pipelineRouter from '../routes/pipeline';
import messagesRouter from '../routes/messages';
import { prisma } from '../database';

type MockRequest = {
  method: string;
  url: string;
  params: Record<string, string>;
  body?: any;
  user?: any;
  ip?: string;
  connection?: { remoteAddress?: string };
  get: (_name: string) => string | undefined;
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

  const request: MockRequest = {
    method: method.toUpperCase(),
    url: routePath,
    get: () => undefined,
    ...req,
  };
  const response = createMockResponse();

  for (const stackItem of layer.route.stack) {
    if (response.ended) {
      break;
    }

    await new Promise<void>((resolve, reject) => {
      let resolved = false;
      const done = (err?: unknown) => {
        if (resolved) {
          return;
        }
        resolved = true;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
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

test('Route abuse - pipeline stage update denies cross-tenant access', async () => {
  const originalFindUnique = prisma.deal.findUnique;
  const originalFindFirst = prisma.deal.findFirst;
  const originalUpdate = prisma.deal.update;

  (prisma.deal.findUnique as any) = async () => ({ id: 'deal-x', sme: { userId: 'owner-1' } });
  (prisma.deal.findFirst as any) = async () => null;
  (prisma.deal.update as any) = async () => {
    throw new Error('should-not-update');
  };

  try {
    const response = await invokeRoute(pipelineRouter, 'put', '/deals/:id/stage', {
      params: { id: 'deal-x' },
      body: { newStage: 'FUNDED' },
      user: {
        id: 'admin-1',
        role: 'ADMIN',
        tenantId: 'tenant-a',
        email: 'admin@test.com',
      },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
    });

    assert.strictEqual(response.statusCode, 404);
  } finally {
    (prisma.deal.findUnique as any) = originalFindUnique;
    (prisma.deal.findFirst as any) = originalFindFirst;
    (prisma.deal.update as any) = originalUpdate;
  }
});

test('Route abuse - messages start denies cross-tenant recipient', async () => {
  const originalUserFindFirst = prisma.user.findFirst;
  const originalConvFindFirst = (prisma as any).conversation.findFirst;
  const originalConvCreate = (prisma as any).conversation.create;

  (prisma.user.findFirst as any) = async () => null;
  (prisma as any).conversation.findFirst = async () => null;
  (prisma as any).conversation.create = async () => {
    throw new Error('should-not-create-conversation');
  };

  try {
    const response = await invokeRoute(messagesRouter, 'post', '/start', {
      params: {},
      body: { recipientId: 'user-b' },
      user: {
        id: 'user-a',
        role: 'INVESTOR',
        tenantId: 'tenant-a',
        email: 'user-a@test.com',
      },
    });

    assert.strictEqual(response.statusCode, 404);
  } finally {
    (prisma.user.findFirst as any) = originalUserFindFirst;
    (prisma as any).conversation.findFirst = originalConvFindFirst;
    (prisma as any).conversation.create = originalConvCreate;
  }
});

test('Route abuse - messages conversation fetch denies tenant mismatch', async () => {
  const originalConvFindUnique = (prisma as any).conversation.findUnique;

  (prisma as any).conversation.findUnique = async () => ({
    id: 'conv-1',
    tenantId: 'tenant-b',
    participants: [{ userId: 'user-a' }],
  });

  try {
    const response = await invokeRoute(messagesRouter, 'get', '/conversations/:id', {
      params: { id: 'conv-1' },
      body: {},
      user: {
        id: 'user-a',
        role: 'INVESTOR',
        tenantId: 'tenant-a',
        email: 'user-a@test.com',
      },
    });

    assert.strictEqual(response.statusCode, 403);
  } finally {
    (prisma as any).conversation.findUnique = originalConvFindUnique;
  }
});
