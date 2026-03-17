import { Request } from 'express';

function normalizeHostValue(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/:\d+$/, '');
}

function isIpv4Host(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function isInternalServiceHost(host: string): boolean {
  return host === '0.0.0.0'
    || host === '::1'
    || host === '[::1]'
    || host.endsWith('.internal')
    || host.endsWith('.railway.internal')
    || host === 'backend'
    || host === 'frontend';
}

function extractHostCandidates(value: string | string[] | undefined): string[] {
  const rawValues = Array.isArray(value) ? value : [value];
  return rawValues
    .flatMap((entry) => String(entry || '').split(','))
    .map(normalizeHostValue)
    .filter(Boolean);
}

/**
 * Resolve tenant identity from trusted request context.
 * In production, only hostname-derived tenanting is trusted.
 */
export function getTenantId(req: Request): string {
  const coreTenantId = process.env.CORE_TENANT_ID || 'default';
  const tradingTenantId = process.env.TRADING_TENANT_ID || 'trade';
  const serviceMode = (process.env.SERVICE_MODE || 'core').toLowerCase();
  if (serviceMode === 'trading') {
    return tradingTenantId;
  }

  const isProduction = process.env.NODE_ENV === 'production';

  // Development/testing override only.
  const headerTenantId = req.headers['x-tenant-id'];
  if (!isProduction && headerTenantId && typeof headerTenantId === 'string') {
    return headerTenantId;
  }

  const serverHostCandidates = [
    ...extractHostCandidates(req.hostname),
    ...extractHostCandidates(req.headers['host']),
  ];

  const primaryServerHost = serverHostCandidates[0] || '';
  const shouldTrustForwardedHost =
    !isProduction
    || !primaryServerHost
    || primaryServerHost.includes('localhost')
    || primaryServerHost.includes('127.0.0.1')
    || primaryServerHost.endsWith('railway.app')
    || isIpv4Host(primaryServerHost)
    || isInternalServiceHost(primaryServerHost);

  const hostCandidates = [
    ...serverHostCandidates,
    ...(shouldTrustForwardedHost ? extractHostCandidates(req.headers['x-forwarded-host']) : []),
  ];

  // Prefer any explicit public Cambobia host in the forwarded chain.
  const explicitPlatformHost = hostCandidates.find((candidate) =>
    candidate === 'cambobia.com'
    || candidate === 'www.cambobia.com'
    || candidate === 'trade.cambobia.com'
    || candidate.endsWith('.cambobia.com')
  );

  const host = explicitPlatformHost || hostCandidates[0] || '';

  // Platform domains map to explicit core/trading tenants.
  if (host === 'cambobia.com' || host === 'www.cambobia.com') {
    return coreTenantId;
  }
  if (host === 'trade.cambobia.com') {
    return tradingTenantId;
  }

  const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1');
  const isRailwayHost = host.endsWith('railway.app');
  const isIpAddress = isIpv4Host(host);
  const isInternalHost = isInternalServiceHost(host);

  if (isLocalHost || isRailwayHost || isIpAddress || isInternalHost) {
    return coreTenantId;
  }

  if (host.includes('.')) {
    const parts = host.split('.').filter(Boolean);

    // Canonical domain handling: tenant.cambobia.com
    if (host.endsWith('.cambobia.com') && parts.length >= 3) {
      const subdomain = parts[0];
      if (subdomain && subdomain !== 'www') {
        return subdomain;
      }
    }

    // Generic multi-subdomain fallback: tenant.example.com
    if (parts.length >= 3) {
      const subdomain = parts[0];
      if (subdomain && subdomain !== 'www') {
        return subdomain;
      }
    }
  }

  return coreTenantId;
}
