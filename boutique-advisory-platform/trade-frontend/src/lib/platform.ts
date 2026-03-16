export const isTradingHostname = (hostname: string): boolean => {
  const host = String(hostname || '').toLowerCase().trim();
  return host === 'trade.cambobia.com'
    || host.endsWith('.trade.cambobia.com')
    || host.includes('trade.cambobia.com')
    || host.includes('trading.railway')
    || host.includes('trade-');
};

export const shouldEnableOneSignal = (hostname: string): boolean => {
  void hostname;
  // Push notifications are intentionally suspended until platform rollout is re-enabled.
  return false;
};

export const PLATFORM_MODE = 'trading';
export const IS_TRADING_PLATFORM = true;
export const CORE_FRONTEND_URL = (process.env.NEXT_PUBLIC_CORE_FRONTEND_URL || 'https://www.cambobia.com').replace(/\/+$/, '');
export const TRADING_FRONTEND_URL = (process.env.NEXT_PUBLIC_TRADING_FRONTEND_URL || 'https://trade.cambobia.com').replace(/\/+$/, '');

export const resolveTradingRuntime = (hostname?: string, pathname?: string): boolean => {
  void hostname;
  void pathname;
  return true; // Trading platform always evaluates as true
};
