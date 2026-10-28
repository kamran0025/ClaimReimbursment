import { createApp } from './app';
import { env } from './lib/env';
import { logger } from './lib/logger';
import { startScheduler } from './jobs/scheduler';

const app = createApp();

app.listen(env.port, () => {
  logger.info(`API listening on port ${env.port}`);
  startScheduler();
});
