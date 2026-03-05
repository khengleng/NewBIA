import { Request } from 'express';

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

  // Use Express-trusted hostname only (avoid direct trust in forwarded headers).
  const host = String(req.hostname || '').trim().toLowerCase();

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
