import emailjs, { EmailJSResponseStatus } from '@emailjs/nodejs';
import type { EmailMessage, Notifier } from './notifier';

export interface EmailJsConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey: string;
}

// TODO: dev phase only — every email goes to this inbox instead of the real
// recipient, who is named in the subject and body. Send to `message.to` once
// real user emails are in place.
const DEV_INBOX = 'kamran@simform.com';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Sends through a dashboard-managed EmailJS template. The template expects
// these params: to_email, subject, title, summary (HTML), source_url, run_date.
export class EmailJsNotifier implements Notifier {
  constructor(private readonly config: EmailJsConfig) {}

  async send(message: EmailMessage): Promise<void> {
    const intended = `${message.toName} <${message.to}>`;
    const params = {
      to_email: DEV_INBOX,
      subject: `[For ${message.toName}] ${message.subject}`,
      title: message.title,
      summary:
        `<p style="padding:8px 12px;background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;">` +
        `<strong>Intended recipient:</strong> ${escapeHtml(intended)}</p>${message.html}`,
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
