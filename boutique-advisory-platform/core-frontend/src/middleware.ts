import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  mapAdminPathToTradingOperator,
  mapLegacyTradingPath,
} from '@/lib/tradingOperatorRoutes';

const mode = process.env.NEXT_PUBLIC_PLATFORM_MODE === 'core' ? 'core' : 'trading';

const coreProtectedPrefixes = ['/dashboard', '/portfolio', '/smes', '/investors', '/advisory'];
const redirectToTradingPrefixes = [
  '/secondary-trading',
  '/trading',
  '/admin/trading-ops',
];

const coreSessionCookieNames = [
  'token',
  'accessToken',
  'refreshToken',
];

function hasCoreSessionCookie(req: NextRequest): boolean {
  return coreSessionCookieNames.some((name) => {
    const value = req.cookies.get(name)?.value;
    return typeof value === 'string' && value.trim().length > 0;
  });
}

const staticCorePrefixes = [
  '/auth',
  '/api-proxy',
  '/_next',
  '/icons',
  '/manifest.json',
  '/sw.js',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/api/health',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Permanent Whitelist for health checks
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  const isAuthenticated = hasCoreSessionCookie(req);

  // Root redirect logic
  if (pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = isAuthenticated ? '/dashboard' : '/auth/login';
    return NextResponse.redirect(url);
  }

  if (redirectToTradingPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    const tradingUrl = new URL(process.env.NEXT_PUBLIC_TRADING_FRONTEND_URL || 'https://trade.cambobia.com');
    const redirectUrl = new URL(pathname, tradingUrl.origin);
    redirectUrl.search = req.nextUrl.search;
    return NextResponse.redirect(redirectUrl);
  }

  // Static Assets and Auth paths
  if (staticCorePrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Protected Routes logic
  if (coreProtectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    if (!isAuthenticated) {
      const url = req.nextUrl.clone();
      url.pathname = '/auth/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Fallback
  if (!isAuthenticated && !pathname.startsWith('/auth')) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\..*).*)', '/'],
};
