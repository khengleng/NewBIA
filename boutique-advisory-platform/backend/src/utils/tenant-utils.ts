import { Request } from 'express';

function normalizeHostValue(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/:\d+$/, '');
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

  const hostCandidates = [
    ...extractHostCandidates(req.headers['x-forwarded-host']),
    ...extractHostCandidates(req.headers['host']),
    ...extractHostCandidates(req.hostname),
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

  if (host.includes('.') && !isLocalHost && !isRailwayHost) {
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

  // Development/testing override only.
  const headerTenantId = req.headers['x-tenant-id'];
  if (!isProduction && headerTenantId && typeof headerTenantId === 'string') {
    return headerTenantId;
  }

  return coreTenantId;
}
