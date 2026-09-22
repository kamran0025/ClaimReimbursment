import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Single shared client for the process (per Prisma's recommended pattern —
// avoids exhausting the Postgres connection pool under ts-node/tsx watch reloads).
export const prisma = new PrismaClient({
  datasourceUrl: env.databaseUrl,
  log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
});
