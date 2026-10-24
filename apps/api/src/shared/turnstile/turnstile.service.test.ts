import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SITEVERIFY_URL } from './constants';
import { TurnstileUnavailableError, verifyTurnstileToken } from './turnstile.service';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('verifyTurnstileToken', () => {
  it('posts secret, response and remoteip to siteverify', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));

    const result = await verifyTurnstileToken('secret-key', 'token-123', '1.2.3.4');

    expect(result).toEqual({ success: true, errorCodes: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(SITEVERIFY_URL);
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.get('secret')).toBe('secret-key');
    expect(body.get('response')).toBe('token-123');
    expect(body.get('remoteip')).toBe('1.2.3.4');
  });

  it('omits remoteip when not provided', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));

    await verifyTurnstileToken('secret-key', 'token-123');

    const body = (fetchMock.mock.calls[0]![1] as RequestInit).body as URLSearchParams;
    expect(body.get('remoteip')).toBeNull();
  });

  it('returns success false with error codes when Cloudflare rejects', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, 'error-codes': ['invalid-input-response'] }),
    );

    const result = await verifyTurnstileToken('secret-key', 'bad-token');

    expect(result).toEqual({ success: false, errorCodes: ['invalid-input-response'] });
  });

  it('throws TurnstileUnavailableError on a non-200 response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 500));

    await expect(verifyTurnstileToken('secret-key', 'token')).rejects.toBeInstanceOf(
      TurnstileUnavailableError,
    );
  });

  it('throws TurnstileUnavailableError when the request fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(verifyTurnstileToken('secret-key', 'token')).rejects.toBeInstanceOf(
      TurnstileUnavailableError,
    );
  });
});
