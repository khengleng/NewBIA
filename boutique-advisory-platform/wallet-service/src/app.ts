import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import walletRoutes from './routes/wallet';
import type { WalletServiceConfig } from './config';
import { authenticateToken } from './middleware/jwt-auth';

export function createApp(config: WalletServiceConfig) {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('combined'));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: config.serviceName,
      version: config.serviceVersion,
      mode: process.env.SERVICE_MODE || 'trading'
    });
  });

  app.get('/ready', (_req, res) => {
    res.json({
      status: 'ready',
      service: config.serviceName,
      version: config.serviceVersion
    });
  });

  app.get('/live', (_req, res) => {
    res.json({
      status: 'alive',
      service: config.serviceName,
      version: config.serviceVersion
    });
  });

  app.use('/api/wallet', authenticateToken, walletRoutes);

  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      service: config.serviceName,
      path: req.path
    });
  });

  return app;
}
