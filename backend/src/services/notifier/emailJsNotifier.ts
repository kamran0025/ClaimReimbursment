import emailjs, { EmailJSResponseStatus } from '@emailjs/nodejs';
import type { EmailMessage, Notifier } from './notifier';

export interface EmailJsConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey: string;
}

// Sends through a dashboard-managed EmailJS template. The template expects
// these params: to_email, subject, title, summary (HTML), source_url, run_date.
export class EmailJsNotifier implements Notifier {
  constructor(private readonly config: EmailJsConfig) {}

  async send(message: EmailMessage): Promise<void> {
    const params = {
      to_email: message.to,
      subject: message.subject,
      title: message.title,
      summary: message.html,
      source_url: message.linkUrl,
      run_date: new Date().toISOString(),
    };
    try {
      await emailjs.send(this.config.serviceId, this.config.templateId, params, {
        publicKey: this.config.publicKey,
        privateKey: this.config.privateKey,
      });
    } catch (error) {
      // A missing service/template/public key rejects with a plain string.
      if (typeof error === 'string') throw new Error(`EmailJS: ${error}`);
      if (error instanceof EmailJSResponseStatus) throw new Error(`EmailJS rejected the email (${error.status}): ${error.text}`);
      throw error;
    }
  }
}
