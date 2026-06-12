import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted so the vi.mock factories (themselves hoisted above imports) can
// reference these. `email.host` is flipped per test to toggle the real-transport
// path vs the mocked (no SMTP_HOST) path.
const { sendMock, email } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  email: {
    host: 'smtp.test' as string | undefined,
    port: 587,
    user: 'u' as string | undefined,
    pass: 'p' as string | undefined,
    secure: false,
    from: 'Blog <noreply@example.com>',
  },
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: sendMock })) },
}));

vi.mock('../../../shared/app.config', () => ({
  config: { email, frontendHost: ['https://tsyvinda.com'] },
}));

import { EmailService } from './email.service';

beforeEach(() => {
  sendMock.mockReset();
  email.host = 'smtp.test';
});

describe('EmailService.sendWelcomeEmail', () => {
  it('renders the username into the email and sends it via SMTP', async () => {
    sendMock.mockResolvedValue({ messageId: 'id' });
    const service = new EmailService();

    await service.sendWelcomeEmail({ to: 'jane@example.com', username: 'Jane' });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Blog <noreply@example.com>',
        to: 'jane@example.com',
        subject: 'Welcome!',
        html: expect.stringContaining('Jane'),
        // @react-email/render uppercases heading text in plain-text output
        text: expect.stringContaining('JANE'),
      }),
    );
  });

  it('throws a 502 EMAIL_SEND_FAILED when SMTP send fails', async () => {
    sendMock.mockRejectedValue(new Error('boom'));
    const service = new EmailService();

    await expect(
      service.sendWelcomeEmail({ to: 'jane@example.com', username: 'Jane' }),
    ).rejects.toMatchObject({ status: 502, code: 'EMAIL_SEND_FAILED' });
  });

  it('skips sending when no SMTP host is configured (mocked path)', async () => {
    email.host = undefined;
    const service = new EmailService();

    await expect(
      service.sendWelcomeEmail({ to: 'jane@example.com', username: 'Jane' }),
    ).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('EmailService.sendVerificationEmail', () => {
  it('renders the name and confirmation URL and sends it via SMTP', async () => {
    sendMock.mockResolvedValue({ messageId: 'id' });
    const service = new EmailService();
    const url = 'https://tsyvinda.com/registration?token=abc';

    await service.sendVerificationEmail({ to: 'jane@example.com', firstName: 'Jane', url });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Blog <noreply@example.com>',
        to: 'jane@example.com',
        subject: 'Confirm your email',
        html: expect.stringContaining(url),
        text: expect.stringContaining('Jane'),
      }),
    );
  });

  it('skips sending when no SMTP host is configured (mocked path)', async () => {
    email.host = undefined;
    const service = new EmailService();

    await expect(
      service.sendVerificationEmail({
        to: 'jane@example.com',
        firstName: 'Jane',
        url: 'https://tsyvinda.com/registration?token=abc',
      }),
    ).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('EmailService.sendPasswordResetEmail', () => {
  it('renders the name and reset URL and sends it via SMTP', async () => {
    sendMock.mockResolvedValue({ messageId: 'id' });
    const service = new EmailService();
    const url = 'https://tsyvinda.com/reset-password?token=abc';

    await service.sendPasswordResetEmail({ to: 'jane@example.com', firstName: 'Jane', url });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Blog <noreply@example.com>',
        to: 'jane@example.com',
        subject: 'Reset your password',
        html: expect.stringContaining(url),
        text: expect.stringContaining('Jane'),
      }),
    );
  });

  it('throws a 502 EMAIL_SEND_FAILED when SMTP send fails', async () => {
    sendMock.mockRejectedValue(new Error('boom'));
    const service = new EmailService();

    await expect(
      service.sendPasswordResetEmail({
        to: 'jane@example.com',
        firstName: 'Jane',
        url: 'https://tsyvinda.com/reset-password?token=abc',
      }),
    ).rejects.toMatchObject({ status: 502, code: 'EMAIL_SEND_FAILED' });
  });

  it('skips sending when no SMTP host is configured (mocked path)', async () => {
    email.host = undefined;
    const service = new EmailService();

    await expect(
      service.sendPasswordResetEmail({
        to: 'jane@example.com',
        firstName: 'Jane',
        url: 'https://tsyvinda.com/reset-password?token=abc',
      }),
    ).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });
});