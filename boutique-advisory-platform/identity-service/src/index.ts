import dotenv from 'dotenv';
dotenv.config();

import { createServer, Server } from 'http';

import { connectDatabase, disconnectDatabase } from './database';
import { config } from './config';
import { createApp } from './app';

const app = createApp(config);
let server: Server | null = null;
let shuttingDown = false;

function validateRuntimeConfig(): void {
  const serviceMode = (process.env.SERVICE_MODE || 'core').toLowerCase();
  if (!['core', 'trading'].includes(serviceMode)) {
    console.error(`[FATAL] Invalid SERVICE_MODE "${serviceMode}". Expected "core" or "trading".`);
    process.exit(1);
  }

  if (serviceMode === 'trading') {
    if (!process.env.TRADING_TENANT_ID) {
      console.error('[FATAL] SERVICE_MODE=trading requires TRADING_TENANT_ID to be set.');
      process.exit(1);
    }
    if (!process.env.TRADING_FRONTEND_URL) {
      console.error('[FATAL] SERVICE_MODE=trading requires TRADING_FRONTEND_URL to be set.');
      process.exit(1);
    }
  }
}

async function start(): Promise<void> {
  validateRuntimeConfig();
  server = createServer(app);
  server.listen(config.port, '0.0.0.0', () => {
    console.log(`${config.serviceName} listening on ${config.port}`);
  });

  // Connect to database in background so we don't block health checks
  connectDatabase().catch((error) => {
    console.error(`🔴 [Background] ${config.serviceName} failed to connect to database:`, error);
  });
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Received ${signal}. Shutting down ${config.serviceName}...`);

  await new Promise<void>((resolve) => {
    if (!server) {
      resolve();
      return;
    }

    server.close(() => resolve());
  });

  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

start().catch((error) => {
  console.error(`Failed to start ${config.serviceName}:`, error);
  process.exit(1);
});
