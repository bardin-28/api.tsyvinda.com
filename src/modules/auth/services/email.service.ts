import { Resend } from 'resend';
import { config } from '../../../shared/app.config';
import { logger } from '../../../shared/logger';
import { HttpError } from '../../../shared/http-error';

interface VerificationEmailInput {
  to: string;
  firstName: string;
  url: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export class EmailService {
  private readonly client: Resend | null;

  constructor(apiKey: string = config.email.resendApiKey) {
    this.client = apiKey === 'test' ? null : new Resend(apiKey);
  }

  async sendVerificationEmail({ to, firstName, url }: VerificationEmailInput): Promise<void> {
    const safeName = escapeHtml(firstName);
    const safeUrl = escapeHtml(url);
    const subject = 'Confirm your email';
    const html = [
      `<p>Hi ${safeName},</p>`,
      `<p>Confirm your email by clicking the link below:</p>`,
      `<p><a href="${safeUrl}">Confirm email</a></p>`,
      `<p>If the button does not work, paste this URL into your browser:</p>`,
      `<p>${safeUrl}</p>`,
      `<p>This link expires in 24 hours.</p>`,
    ].join('');
    const text = `Hi ${firstName},\n\nConfirm your email: ${url}\n\nThis link expires in 24 hours.\n`;

    if (!this.client) {
      logger.debug({ to, url }, 'email:verify (mocked)');
      return;
    }

    const { error } = await this.client.emails.send({
      from: config.email.from,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      throw new HttpError(502, 'EMAIL_SEND_FAILED', 'Failed to send verification email', error);
    }
  }
}

export const emailService = new EmailService();
