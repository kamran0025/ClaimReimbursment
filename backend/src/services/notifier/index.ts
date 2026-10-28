import { env } from '../../lib/env';
import { ConsoleNotifier } from './consoleNotifier';
import { EmailJsNotifier } from './emailJsNotifier';
import type { Notifier } from './notifier';

// EmailJS when its credentials are configured, console logging otherwise (dev/tests).
export const notifier: Notifier = env.emailjs ? new EmailJsNotifier(env.emailjs) : new ConsoleNotifier();
export type { EmailMessage, Notifier } from './notifier';
