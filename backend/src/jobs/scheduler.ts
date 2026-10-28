// In-process scheduled jobs. Started from server.ts only (never app.ts), so
// tests that build the app don't start timers.
import { Cron } from 'croner';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { runApprovalReminderJob } from './approvalReminderJob';

export function startScheduler(): void {
  if (!env.reminders.enabled) {
    logger.info('[scheduler] approval reminders disabled (REMINDERS_ENABLED=false)');
    return;
  }
  // `protect` skips a tick while the previous run is still going.
  const job = new Cron(env.reminders.cron, { name: 'approval-reminders', timezone: env.reminders.timezone, protect: true }, runApprovalReminderJob);
  logger.info(`[scheduler] approval reminders scheduled "${env.reminders.cron}" (${env.reminders.timezone}), next run ${job.nextRun()?.toISOString()}`);
}
