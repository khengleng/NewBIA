function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeOrigins(raw: string | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const config = {
  serviceName: process.env.SERVICE_NAME || 'wallet-service',
  port: Number(process.env.PORT || 3008),
  nodeEnv: process.env.NODE_ENV || 'production',
  jwtSecret: requireEnv('JWT_SECRET'),
  databaseUrl: requireEnv('DATABASE_URL'),
  redisUrl: requireEnv('REDIS_URL'),
  tradingFrontendUrl: process.env.TRADING_FRONTEND_URL || 'https://trade.cambobia.com',
  corsOrigins: normalizeOrigins(process.env.CORS_ORIGIN || process.env.TRADING_FRONTEND_URL || 'https://trade.cambobia.com'),
  serviceVersion: process.env.SERVICE_VERSION || '1.0.0-unspecified',
};

export type WalletServiceConfig = typeof config;
