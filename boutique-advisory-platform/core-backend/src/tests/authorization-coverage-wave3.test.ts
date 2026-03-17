import test from 'node:test';
import assert from 'node:assert';
import { Router } from 'express';
import dashboardRouter from '../routes/dashboard';
import calendarRouter from '../routes/calendar';

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
        if (resolved) return;
        resolved = true;
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

test('Authorization coverage - dashboard denies SUPPORT role', async () => {
  const response = await invokeRoute(dashboardRouter, 'get', '/stats', {
    params: {},
    user: {
      id: 'support-1',
      role: 'SUPPORT',
      tenantId: 'tenant-a',
      email: 'support@test.com',
    },
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
  });

  assert.strictEqual(response.statusCode, 403);
});

test('Authorization coverage - dashboard requires tenant context', async () => {
  const response = await invokeRoute(dashboardRouter, 'get', '/stats', {
    params: {},
    user: {
      id: 'admin-1',
      role: 'ADMIN',
      email: 'admin@test.com',
    },
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
  });

  assert.strictEqual(response.statusCode, 403);
});

test('Authorization coverage - calendar denies SUPPORT role', async () => {
  const response = await invokeRoute(calendarRouter, 'get', '/', {
    params: {},
    user: {
      id: 'support-1',
      role: 'SUPPORT',
      tenantId: 'tenant-a',
      email: 'support@test.com',
    },
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
  });

  assert.strictEqual(response.statusCode, 403);
});

