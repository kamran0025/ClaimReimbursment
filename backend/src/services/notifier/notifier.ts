export interface EmailMessage {
  to: string;
  subject: string;
  /** Heading shown at the top of the email. */
  title: string;
  /** Plain-text body — used for logging when no email provider is configured. */
  text: string;
  /** HTML body inserted into the email template. */
  html: string;
  /** Main call-to-action link (e.g. the reviewer's claim queue). */
  linkUrl: string;
}

/** Outgoing-email boundary. Implementations throw if the message could not be handed off. */
export interface Notifier {
  send(message: EmailMessage): Promise<void>;
}
