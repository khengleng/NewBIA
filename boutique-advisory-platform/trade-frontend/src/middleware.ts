import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  mapAdminPathToTradingOperator,
  mapLegacyTradingPath,
} from '@/lib/tradingOperatorRoutes';

const mode = process.env.NEXT_PUBLIC_PLATFORM_MODE === 'trading' ? 'trading' : 'core';
const isTradingHost = (hostname: string) => {
  const host = String(hostname || '').toLowerCase().trim();
  return host === 'trade.cambobia.com'
    || host.endsWith('.trade.cambobia.com')
    || host.includes('trade.cambobia.com')
    || host.includes('trading.railway')
    || host.includes('trade-');
};

const tradingProtectedPrefixes = ['/secondary-trading', '/trading', '/admin/bot'];
const redirectToCorePrefixes = [
  '/dashboard',
  '/smes',
  '/investors',
  '/deals',
  '/pipeline',
  '/sme-pipeline',
  '/advisory',
  '/dataroom',
  '/documents',
  '/wallet',
  '/messages',
  '/calendar',
  '/community',
  '/matchmaking',
  '/due-diligence',
  '/payments',
  '/reports',
  '/analytics',
];

const tradingSessionCookieNames = [
  'tr_token',
  'tr_accessToken',
  'tr_refreshToken',
];

function hasTradingSessionCookie(req: NextRequest): boolean {
  return tradingSessionCookieNames.some((name) => {
    const value = req.cookies.get(name)?.value;
    return typeof value === 'string' && value.trim().length > 0;
  });
}

const staticTradingPrefixes = [
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

  // 1. Permanent Whitelist for health checks (bypasses all logic)
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  const runtimeTradingMode = mode === 'trading' || isTradingHost(req.nextUrl.hostname);

  const isAuthenticated = hasTradingSessionCookie(req);

  if (pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = isAuthenticated ? '/secondary-trading' : '/auth/login';
    return NextResponse.redirect(url);
  }

  if (staticTradingPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (runtimeTradingMode) {
    const mappedLegacyPath = mapLegacyTradingPath(pathname);
    if (mappedLegacyPath) {
      const url = req.nextUrl.clone();
      url.pathname = mappedLegacyPath;
      return NextResponse.redirect(url);
    }

    const shouldRedirectToCore = redirectToCorePrefixes.some((prefix) => pathname.startsWith(prefix))
      && !pathname.startsWith('/trading')
      && !pathname.startsWith('/secondary-trading');
    if (shouldRedirectToCore) {
      const coreUrl = new URL(process.env.NEXT_PUBLIC_CORE_FRONTEND_URL || 'https://www.cambobia.com');
      const redirectUrl = new URL(pathname, coreUrl.origin);
      redirectUrl.search = req.nextUrl.search;
      return NextResponse.redirect(redirectUrl);
    }

    const mappedAdminPath = mapAdminPathToTradingOperator(pathname);
    if (mappedAdminPath) {
      const url = req.nextUrl.clone();
      url.pathname = mappedAdminPath;
      return NextResponse.redirect(url);
    }
  }

  if (tradingProtectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    if (!isAuthenticated) {
      const url = req.nextUrl.clone();
      url.pathname = '/auth/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = isAuthenticated ? '/secondary-trading' : '/auth/login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!.*\\..*).*)', '/'],
};
