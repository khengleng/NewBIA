export const isTradingHostname = (hostname: string): boolean => hostname === 'trade.cambobia.com';

const envTrading = process.env.NEXT_PUBLIC_PLATFORM_MODE === 'trading';
const hostTrading = typeof window !== 'undefined' && isTradingHostname(window.location.hostname);

export const PLATFORM_MODE = (envTrading || hostTrading) ? 'trading' : 'core';
export const IS_TRADING_PLATFORM = PLATFORM_MODE === 'trading';
export const CORE_FRONTEND_URL = (process.env.NEXT_PUBLIC_CORE_FRONTEND_URL || 'https://www.cambobia.com').replace(/\/+$/, '');
