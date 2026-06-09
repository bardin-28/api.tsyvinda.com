import { createElement } from 'react';
import { Injectable } from '@nestjs/common';
import { render } from '@react-email/render';
import { Resend } from 'resend';
import { config } from '../../../shared/app.config';
import { logger } from '../../../shared/logger';
import { HttpError } from '../../../shared/http-error';
import { WelcomeEmail } from '../../../emails/WelcomeEmail';
import { ConfirmEmail } from '../../../emails/ConfirmEmail';
import { ResetPasswordEmail } from '../../../emails/ResetPasswordEmail';

interface VerificationEmailInput {
  to: string;
  firstName: string;
  url: string;
}

interface PasswordResetEmailInput {
  to: string;
  firstName: string;
  url: string;
}

interface WelcomeEmailInput {
  to: string;
  username: string;
}

// Provided in AuthModule via useFactory (the primitive apiKey constructor param
// cannot be resolved by Nest DI), so it is constructed without arguments at runtime.
@Injectable()
export class EmailService {
  private readonly client: Resend | null;

  constructor(apiKey: string = config.email.resendApiKey) {
    this.client = apiKey === 'test' ? null : new Resend(apiKey);
  }

  async sendVerificationEmail({ to, firstName, url }: VerificationEmailInput): Promise<void> {
    const element = createElement(ConfirmEmail, { firstName, url });
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = 'Confirm your email';

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

  async sendWelcomeEmail({ to, username }: WelcomeEmailInput): Promise<void> {
    const appUrl = config.frontendHost[0];
    const element = createElement(WelcomeEmail, { username, appUrl });
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = 'Welcome!';

    if (!this.client) {
      logger.debug({ to }, 'email:welcome (mocked)');
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
      throw new HttpError(502, 'EMAIL_SEND_FAILED', 'Failed to send welcome email', error);
    }
  }

  async sendPasswordResetEmail({ to, firstName, url }: PasswordResetEmailInput): Promise<void> {
    const element = createElement(ResetPasswordEmail, { firstName, url });
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = 'Reset your password';

    if (!this.client) {
      logger.debug({ to, url }, 'email:reset-password (mocked)');
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
      throw new HttpError(502, 'EMAIL_SEND_FAILED', 'Failed to send password reset email', error);
    }
  }
}
