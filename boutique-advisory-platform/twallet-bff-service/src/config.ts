function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function normalizeOrigins(raw: string | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export const config = {
  serviceName: process.env.SERVICE_NAME || 'twallet-bff-service',
  port: Number(process.env.PORT || 3010),
  nodeEnv: process.env.NODE_ENV || 'production',
  mobileAppUrl: process.env.MOBILE_APP_URL || 'https://mobile-app-production-bf9a.up.railway.app',
  corsOrigins: normalizeOrigins(process.env.CORS_ORIGIN || process.env.MOBILE_APP_URL || 'https://mobile-app-production-bf9a.up.railway.app'),
  identityServiceUrl: requireEnv('IDENTITY_SERVICE_URL'),
  walletServiceUrl: requireEnv('WALLET_SERVICE_URL'),
  fundingServiceUrl: requireEnv('FUNDING_SERVICE_URL'),
  marketServiceUrl: requireEnv('MARKET_SERVICE_URL'),
  tradeApiUrl: requireEnv('TRADE_API_URL'),
  blockchainGatewayUrl: process.env.BLOCKCHAIN_GATEWAY_URL || '',
  tradingFrontendHost: process.env.TRADING_FRONTEND_HOST || 'trade.cambobia.com',
}

export type TWalletBffConfig = typeof config
