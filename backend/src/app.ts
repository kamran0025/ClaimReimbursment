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
import { requestLogger } from './middleware/requestLogger';

export function createApp() {
  const app = express();

  app.use(requestLogger);
  app.use(
    cors({
      // Reflects the request's Origin back only if it's in the CORS_ORIGIN
      // allowlist (supports serving more than one known frontend — see
      // lib/env.ts) — this is NOT the same as `origin: '*'`, which the CORS
      // spec forbids combining with `credentials: true` anyway (our cookie
      // auth requires credentials, so a true wildcard isn't an option here).
      // No Origin header at all (curl, server-to-server, same-origin) is let through.
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} is not allowed by CORS.`));
        }
      },
      credentials: true,
    }),
  );
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
