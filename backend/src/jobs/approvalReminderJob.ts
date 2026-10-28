import { logger } from '../lib/logger';
import { runApprovalReminders } from '../services/approvalReminderService';

/** One scheduled run: never throws, so a failure can't take the scheduler (or the process) down. */
export async function runApprovalReminderJob(): Promise<void> {
  try {
    const { claimsReminded, emailsSent, emailsFailed } = await runApprovalReminders();
    logger.info(`[reminders] reminded about ${claimsReminded} claim(s): ${emailsSent} email(s) sent, ${emailsFailed} failed`);
  } catch (err) {
    logger.error(`[reminders] run failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
