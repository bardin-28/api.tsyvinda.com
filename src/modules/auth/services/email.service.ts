import { createElement, type ReactElement } from 'react';
import { Injectable } from '@nestjs/common';
import { render } from '@react-email/render';
import nodemailer, { type Transporter } from 'nodemailer';
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

// SMTP delivery via nodemailer. Prod targets AWS SES (STARTTLS on 587, auth from
// the SealedSecret); local targets the in-cluster Mailpit catcher (no auth/TLS).
// When SMTP_HOST is unset (tests) the transport is null and sends are mocked.
@Injectable()
export class EmailService {
  private readonly transport: Transporter | null;

  constructor() {
    const { host, port, user, pass, secure } = config.email;
    this.transport = host
      ? nodemailer.createTransport({
          host,
          port,
          secure, // true for 465; 587 uses STARTTLS (secure=false, auto-upgraded)
          auth: user && pass ? { user, pass } : undefined,
        })
      : null;
  }

  // Renders the React email to HTML + plain text and sends it. No-op (logged)
  // when no transport is configured, so tests don't hit a real SMTP server.
  private async deliver(
    label: string,
    to: string,
    subject: string,
    element: ReactElement,
    logContext: Record<string, unknown>,
  ): Promise<void> {
    if (!this.transport) {
      logger.debug({ to, ...logContext }, `email:${label} (mocked)`);
      return;
    }

    const html = await render(element);
    const text = await render(element, { plainText: true });

    // Route through the SES configuration set (prod) so delivery/bounce/complaint
    // events are published to CloudWatch. Omitted locally (Mailpit ignores it).
    const headers = config.email.configurationSet
      ? { 'X-SES-CONFIGURATION-SET': config.email.configurationSet }
      : undefined;

    try {
      await this.transport.sendMail({ from: config.email.from, to, subject, html, text, headers });
    } catch (error) {
      throw new HttpError(502, 'EMAIL_SEND_FAILED', `Failed to send ${label} email`, error);
    }
  }

  async sendVerificationEmail({ to, firstName, url }: VerificationEmailInput): Promise<void> {
    await this.deliver('verify', to, 'Confirm your email', createElement(ConfirmEmail, { firstName, url }), { url });
  }

  async sendWelcomeEmail({ to, username }: WelcomeEmailInput): Promise<void> {
    const appUrl = config.frontendHost[0];
    await this.deliver('welcome', to, 'Welcome!', createElement(WelcomeEmail, { username, appUrl }), {});
  }

  async sendPasswordResetEmail({ to, firstName, url }: PasswordResetEmailInput): Promise<void> {
    await this.deliver(
      'reset-password',
      to,
      'Reset your password',
      createElement(ResetPasswordEmail, { firstName, url }),
      { url },
    );
  }
}