import { describe, it, expect, vi, afterEach } from 'vitest';
import { RevalidationService } from './revalidation.service';

afterEach(() => vi.unstubAllGlobals());

describe('RevalidationService', () => {
  it('posts unique tags with the bearer secret', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new RevalidationService();
    service.options = { url: 'https://site.test/api/revalidate', secret: 's'.repeat(32) };
    service.revalidate(['routes', 'page:about', 'routes']);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://site.test/api/revalidate');
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${'s'.repeat(32)}` });
    expect(JSON.parse(init.body as string)).toEqual({ tags: ['routes', 'page:about'] });
  });

  it('does nothing when unconfigured and never throws on failure', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('down');
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = new RevalidationService();
    service.options = {};
    service.revalidate(['routes']);
    expect(fetchMock).not.toHaveBeenCalled();
    service.options = { url: 'https://site.test/api/revalidate', secret: 'x'.repeat(32) };
    expect(() => service.revalidate(['routes'])).not.toThrow();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });
});
