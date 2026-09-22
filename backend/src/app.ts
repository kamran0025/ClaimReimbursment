import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './lib/env';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { claimsRouter } from './routes/claims';
import { auditRouter } from './routes/audit';
import { financeRouter } from './routes/finance';
import { dashboardsRouter } from './routes/dashboards';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/claims', claimsRouter);
  app.use('/audit', auditRouter);
  app.use('/finance', financeRouter);
  app.use('/dashboards', dashboardsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
