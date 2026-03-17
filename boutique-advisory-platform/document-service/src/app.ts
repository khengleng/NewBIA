import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import dataroomRoutes from './routes/dataroom';
import documentRoutes from './routes/document';
import type { DocumentServiceConfig } from './config';
import { authenticateToken } from './middleware/jwt-auth';

export function createApp(config: DocumentServiceConfig) {
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
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(morgan('combined'));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: config.serviceName
    });
  });

  app.use('/api', authenticateToken);
  app.use('/api/dataroom', dataroomRoutes);
  app.use('/api/document', documentRoutes);

  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      service: config.serviceName,
      path: req.path
    });
  });

  return app;
}
