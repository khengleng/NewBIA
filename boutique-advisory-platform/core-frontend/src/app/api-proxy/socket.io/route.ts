import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function resolveBackendBase(): string {
  const tradingBuild = process.env.NEXT_PUBLIC_PLATFORM_MODE === 'trading';
  const railwayPrivateBackend = tradingBuild
    ? (
        process.env.RAILWAY_SERVICE_TRADING_URL
          ? `http://${process.env.RAILWAY_SERVICE_TRADING_URL}`
          : process.env.RAILWAY_SERVICE_TRADING_BACKEND_URL
            ? `http://${process.env.RAILWAY_SERVICE_TRADING_BACKEND_URL}`
            : process.env.RAILWAY_SERVICE_TRADE_API_URL
              ? `http://${process.env.RAILWAY_SERVICE_TRADE_API_URL}`
              : process.env.RAILWAY_SERVICE_TRADE_API_INTERNAL_URL
                ? `http://${process.env.RAILWAY_SERVICE_TRADE_API_INTERNAL_URL}`
                : 'http://trade-api.railway.internal:8080'
      )
    : (
        process.env.RAILWAY_SERVICE_BACKEND_URL
          ? `http://${process.env.RAILWAY_SERVICE_BACKEND_URL}`
          : process.env.RAILWAY_SERVICE_CORE_BACKEND_URL
            ? `http://${process.env.RAILWAY_SERVICE_CORE_BACKEND_URL}`
            : process.env.RAILWAY_SERVICE_CORE_BACKEND_INTERNAL_URL
              ? `http://${process.env.RAILWAY_SERVICE_CORE_BACKEND_INTERNAL_URL}`
              : 'http://core-backend.railway.internal:8080'
      );

  const apiUrl = tradingBuild
    ? (
        process.env.TRADING_API_URL ||
        process.env.TRADING_BACKEND_INTERNAL_URL ||
        process.env.TRADING_BACKEND_URL ||
        process.env.API_URL ||
        process.env.BACKEND_INTERNAL_URL ||
        process.env.BACKEND_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        railwayPrivateBackend
      )
    : (
        process.env.CORE_API_URL ||
        process.env.CORE_BACKEND_INTERNAL_URL ||
        process.env.CORE_BACKEND_URL ||
        process.env.API_URL ||
        process.env.BACKEND_INTERNAL_URL ||
        process.env.BACKEND_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        railwayPrivateBackend
      );

  return apiUrl.replace(/\/api\/?$/, '');
}

async function proxySocket(req: NextRequest): Promise<NextResponse> {
  const base = resolveBackendBase();
  const suffix = req.nextUrl.pathname.replace('/api-proxy/socket.io', '');
  const socketPath = suffix ? `/socket.io${suffix}` : '/socket.io/';
  const upstreamUrl = `${base}${socketPath}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.set('x-forwarded-host', req.nextUrl.host);
  headers.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', ''));

  const method = req.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : Buffer.from(await req.arrayBuffer());

  const upstream = await fetch(upstreamUrl, {
    method,
    headers,
    body,
    cache: 'no-store',
    redirect: 'manual',
  });

  const response = new NextResponse(await upstream.arrayBuffer(), { status: upstream.status });
  upstream.headers.forEach((value, key) => {
    response.headers.set(key, value);
  });
  response.headers.set('x-proxy-target', base);
  return response;
}

export async function GET(req: NextRequest) {
  return proxySocket(req);
}

export async function POST(req: NextRequest) {
  return proxySocket(req);
}

export async function OPTIONS(req: NextRequest) {
  return proxySocket(req);
}
