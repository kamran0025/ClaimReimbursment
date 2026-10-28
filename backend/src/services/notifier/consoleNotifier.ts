import { logger } from '../../lib/logger';
import type { EmailMessage, Notifier } from './notifier';

/** Used when EmailJS isn't configured (dev, tests): logs the email instead of sending it. */
export class ConsoleNotifier implements Notifier {
  async send(message: EmailMessage): Promise<void> {
    logger.info(`[email] to=${message.to} subject="${message.subject}"\n${message.text}`);
  }
}
