import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { EmailService } from './email.service';

describe('EmailService.sendWelcomeEmail', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('renders the username into the email and sends it via Resend', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email-id' }, error: null });
    const service = new EmailService('real-api-key');

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

  it('throws a 502 EMAIL_SEND_FAILED when Resend returns an error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const service = new EmailService('real-api-key');

    await expect(
      service.sendWelcomeEmail({ to: 'jane@example.com', username: 'Jane' }),
    ).rejects.toMatchObject({ status: 502, code: 'EMAIL_SEND_FAILED' });
  });

  it('skips sending in the mocked client path (apiKey "test")', async () => {
    const service = new EmailService('test');

    await expect(
      service.sendWelcomeEmail({ to: 'jane@example.com', username: 'Jane' }),
    ).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('EmailService.sendVerificationEmail', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('renders the name and confirmation URL and sends it via Resend', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email-id' }, error: null });
    const service = new EmailService('real-api-key');
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

  it('skips sending in the mocked client path (apiKey "test")', async () => {
    const service = new EmailService('test');

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
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('renders the name and reset URL and sends it via Resend', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email-id' }, error: null });
    const service = new EmailService('real-api-key');
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

  it('throws a 502 EMAIL_SEND_FAILED when Resend returns an error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const service = new EmailService('real-api-key');

    await expect(
      service.sendPasswordResetEmail({
        to: 'jane@example.com',
        firstName: 'Jane',
        url: 'https://tsyvinda.com/reset-password?token=abc',
      }),
    ).rejects.toMatchObject({ status: 502, code: 'EMAIL_SEND_FAILED' });
  });

  it('skips sending in the mocked client path (apiKey "test")', async () => {
    const service = new EmailService('test');

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
