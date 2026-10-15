import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isTest } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { apiLimiter } from './middleware/rateLimit';
import routes from './routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL.split(','), credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  if (!isTest) app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/', (_req, res) => res.json({ name: 'Smart Parking Management System API', docs: '/api/health' }));
  app.use('/api', apiLimiter, routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
