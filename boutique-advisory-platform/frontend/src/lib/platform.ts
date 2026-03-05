export const isTradingHostname = (hostname: string): boolean => {
  const host = String(hostname || '').toLowerCase().trim();
  return host === 'trade.cambobia.com'
    || host.endsWith('.trade.cambobia.com')
    || host.includes('trade.cambobia.com')
    || host.includes('trading.railway')
    || host.includes('trade-');
};

export const isCoreHostname = (hostname: string): boolean => {
  const host = String(hostname || '').toLowerCase().trim();
  return host === 'cambobia.com'
    || host === 'www.cambobia.com'
    || host.endsWith('.cambobia.com');
};

export const isTradingPathname = (pathname: string): boolean => {
  const path = String(pathname || '').toLowerCase();
  return path.startsWith('/trading')
    || path.startsWith('/secondary-trading');
};

export const resolveTradingRuntime = (hostname?: string, pathname?: string): boolean => {
  return isTradingHostname(String(hostname || '')) || isTradingPathname(String(pathname || ''));
};

export const shouldEnableOneSignal = (hostname: string): boolean => {
  void hostname;
  // Push notifications are intentionally suspended until platform rollout is re-enabled.
  return false;
};

const envTrading = process.env.NEXT_PUBLIC_PLATFORM_MODE === 'trading';
export const PLATFORM_MODE = envTrading ? 'trading' : 'core';
export const IS_TRADING_PLATFORM = PLATFORM_MODE === 'trading';
export const CORE_FRONTEND_URL = (process.env.NEXT_PUBLIC_CORE_FRONTEND_URL || 'https://www.cambobia.com').replace(/\/+$/, '');
