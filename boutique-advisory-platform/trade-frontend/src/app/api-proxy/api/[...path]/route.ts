import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRANSIENT_STATUSES = new Set([502, 503, 504]);
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);

function sanitizeBaseUrl(baseUrl: string | undefined): string | null {
  if (!baseUrl) return null;
  const trimmed = baseUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

function inferServiceUrl(hostOrUrl: string | undefined, fallback: string): string {
  const candidate = (hostOrUrl || '').trim();
  if (!candidate) return fallback;
  if (candidate.startsWith('http://') || candidate.startsWith('https://')) return candidate;

  // Railway internal service hosts should be accessed over plain HTTP.
  if (candidate.endsWith('.railway.internal')) return `http://${candidate}`;

  // Public Railway/custom domains should be accessed via HTTPS to avoid 301 redirects.
  return `https://${candidate}`;
}

function isTradingHost(hostname: string): boolean {
  const host = String(hostname || '').trim().toLowerCase();
  return host === 'trade.cambobia.com'
    || host.endsWith('.trade.cambobia.com')
    || host.includes('trade.cambobia.com')
    || host.includes('trading.railway')
    || host.includes('trade-');
}

function looksLikeTradingServiceTarget(candidate: string): boolean {
  const value = String(candidate || '').trim().toLowerCase();
  if (!value) return false;
  // Match known trading backend/service patterns so core runtime never proxies there.
  return value.includes('trade.cambobia.com')
    || value.includes('trading.railway')
    || value.includes('trade-')
    || value.includes('trading-backend')
    || value.includes('/trading');
}

function isTradingRuntime(req: NextRequest): boolean {
  if (process.env.NEXT_PUBLIC_PLATFORM_MODE === 'trading') return true;
  return isTradingHost(req.nextUrl.hostname);
}

function getBackendTargets(req: NextRequest): string[] {
  const targets: string[] = [];
  const tradingRuntime = isTradingRuntime(req);
  const currentHost = req.headers.get('host')?.toLowerCase() || req.nextUrl.host.toLowerCase();

  const addTarget = (candidate?: string) => {
    const sanitized = sanitizeBaseUrl(candidate);
    if (!sanitized) return;

    // Guardrail: do not proxy to ourselves (prevents infinite loops and 404s from misconfigured env vars)
    try {
      const targetHost = new URL(sanitized).host.toLowerCase();
      if (targetHost === currentHost) return;
    } catch {
      return;
    }

    if (targets.includes(sanitized)) return;
    targets.push(sanitized);
  };

  const coreInternalBackend = inferServiceUrl(
    process.env.RAILWAY_SERVICE_BACKEND_URL,
    'http://backend.railway.internal:8080'
  );
  const tradingInternalBackend = inferServiceUrl(
    process.env.RAILWAY_SERVICE_TRADING_URL || process.env.RAILWAY_SERVICE_TRADING_BACKEND_URL,
    'http://trading.railway.internal:8080'
  );

  // Strategy: Prioritize based on runtime, but always include fallbacks
  if (tradingRuntime) {
    // Priority: Trading -> Core -> Others
    addTarget(process.env.TRADING_API_URL);
    addTarget(process.env.TRADING_BACKEND_INTERNAL_URL);
    addTarget(process.env.TRADING_BACKEND_URL);
    addTarget(tradingInternalBackend);

    addTarget(process.env.CORE_API_URL);
    addTarget(process.env.CORE_BACKEND_INTERNAL_URL);
    addTarget(process.env.CORE_BACKEND_URL);
    addTarget(coreInternalBackend);
  } else {
    // Priority: Core -> Trading -> Others
    addTarget(process.env.CORE_API_URL);
    addTarget(process.env.CORE_BACKEND_INTERNAL_URL);
    addTarget(process.env.CORE_BACKEND_URL);
    addTarget(coreInternalBackend);

    addTarget(process.env.TRADING_API_URL);
    addTarget(process.env.TRADING_BACKEND_INTERNAL_URL);
    addTarget(process.env.TRADING_BACKEND_URL);
    addTarget(tradingInternalBackend);
  }

  // Common fallbacks
  addTarget(process.env.API_URL);
  addTarget(process.env.BACKEND_INTERNAL_URL);
  addTarget(process.env.BACKEND_URL);
  addTarget(process.env.NEXT_PUBLIC_API_URL);

  return targets;
}

function buildUpstreamHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) return;
    headers.set(key, value);
  });

  headers.set('x-forwarded-host', req.nextUrl.host);
  headers.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', ''));
  headers.set('x-forwarded-for', req.headers.get('x-forwarded-for') || 'unknown');
  return headers;
}


async function shouldRetryForPlatformNotFound(upstream: Response): Promise<boolean> {
  if (upstream.status !== 404) return false;
  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/json')) {
    return false;
  }

  const bodyText = await upstream.clone().text();
  const normalized = bodyText.toLowerCase();
  const hasNotFoundMarker = normalized.includes('application not found');
  const hasProviderMarker =
    normalized.includes('railway')
    || normalized.includes('cloudflare')
    || normalized.includes('deployment');

  // Retry only when the 404 body clearly looks like provider/platform routing
  // rather than a legitimate application-level 404 from our backend.
  return hasNotFoundMarker && hasProviderMarker;
}

function copyUpstreamHeaders(upstream: Response, response: NextResponse): void {
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) return;
    if (lower === 'set-cookie') return;
    response.headers.set(key, value);
  });

  // Next/undici supports getSetCookie() for multi-cookie passthrough.
  const setCookies = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  if (setCookies && setCookies.length > 0) {
    for (const cookie of setCookies) {
      response.headers.append('set-cookie', cookie);
    }
    return;
  }

  const fallbackCookie = upstream.headers.get('set-cookie');
  if (fallbackCookie) {
    response.headers.append('set-cookie', fallbackCookie);
  }
}

async function proxy(req: NextRequest, pathParts: string[]): Promise<NextResponse> {
  const targets = getBackendTargets(req);
  if (targets.length === 0) {
    console.error(`❌ [Proxy] No backend targets found for request to /api/${pathParts.join('/')}`);
    return NextResponse.json(
      { error: 'Backend proxy is not configured.' },
      { status: 503 }
    );
  }

  const upstreamPath = `/api/${pathParts.join('/')}${req.nextUrl.search}`;
  const method = req.method.toUpperCase();
  const headers = buildUpstreamHeaders(req);
  const requestBody =
    method === 'GET' || method === 'HEAD' ? undefined : Buffer.from(await req.arrayBuffer());

  for (let i = 0; i < targets.length; i += 1) {
    const targetBase = targets[i];
    const upstreamUrl = `${targetBase}${upstreamPath}`;
    const isLastTarget = i === targets.length - 1;

    try {

      console.log(`📡 [Proxy] ${method} -> ${targetBase}/api/${pathParts.join('/')}`);
      const upstream = await fetch(upstreamUrl, {
        method,
        headers,
        body: requestBody,
        cache: 'no-store',
        redirect: 'manual'
      });

      const shouldRetry = TRANSIENT_STATUSES.has(upstream.status)
        || (await shouldRetryForPlatformNotFound(upstream));

      if (!shouldRetry || isLastTarget) {
        // Read full body buffer to avoid streaming/decoding issues during content forwarding
        const bodyBuffer = await upstream.arrayBuffer();
        const response = new NextResponse(bodyBuffer, { status: upstream.status });

        copyUpstreamHeaders(upstream, response);

        // SECURITY: Strip encoding and length from copied headers as the new body 
        // buffer is already decompressed and Next will set its own length.
        response.headers.delete('content-encoding');
        response.headers.delete('content-length');
        response.headers.delete('transfer-encoding');

        return response;
      }
    } catch (error: any) {
      const errMessage = error?.message || 'Proxy connection failed';
      console.warn(`⚠️ [Proxy Error] Attempt ${i + 1} failed: ${errMessage}`);
      if (isLastTarget) break;
    }
  }

  console.error(`❌ [Proxy Failed] Exhausted all ${targets.length} targets for ${upstreamPath}`);
  return NextResponse.json(
    {
      error: 'Service temporarily unavailable. Please try again in a few seconds.'
    },
    { status: 503 }
  );
}

type RouteParams = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function OPTIONS(req: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { path } = await context.params;
  return proxy(req, path);
}
