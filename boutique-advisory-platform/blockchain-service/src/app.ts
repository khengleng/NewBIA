import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './config';
import healthRoutes from './routes/health';
import tokenRoutes from './routes/token';
import escrowRoutes from './routes/escrow';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('tiny'));

  app.get('/', (_req, res) => {
    res.json({ service: config.serviceName, status: 'ok' });
  });

  app.use('/api/blockchain', healthRoutes);
  app.use('/api/blockchain/token', tokenRoutes);
  app.use('/api/blockchain/escrow', escrowRoutes);

  return app;
}
