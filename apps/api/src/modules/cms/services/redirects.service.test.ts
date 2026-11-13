import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';
import { HttpError } from '../../../shared/http-error';
import { RedirectsService, normalizeSourcePath, normalizeTarget } from './redirects.service';
import type { RevalidationService } from './revalidation.service';

describe('normalizeSourcePath / normalizeTarget', () => {
  it('normalises the source path', () => {
    expect(normalizeSourcePath(' /Old-Page/?x=1 ')).toBe('/old-page');
    expect(normalizeSourcePath('/uk/%D0%B1%D0%BB%D0%BE%D0%B3')).toBe('/uk/блог');
  });

  it('rejects the home page, protocol-relative and relative sources', () => {
    for (const bad of ['/', '//evil.com', 'about']) {
      expect(() => normalizeSourcePath(bad), bad).toThrow(HttpError);
    }
  });

  it('accepts site paths and http(s) URLs as targets', () => {
    expect(normalizeTarget('/uk/about#stack')).toBe('/uk/about#stack');
    expect(normalizeTarget('https://example.com/x')).toBe('https://example.com/x');
    for (const bad of ['javascript:alert(1)', '//evil.com', 'about']) {
      expect(() => normalizeTarget(bad), bad).toThrow(HttpError);
    }
  });
});

describe('RedirectsService.create', () => {
  const repo = {
    findOne: vi.fn(),
    create: vi.fn((row: object) => row),
    save: vi.fn(async (row: object) => ({
      id: 'r1',
      createdAt: new Date(0),
      updatedAt: new Date(0),
      ...row,
    })),
  };
  const revalidate = vi.fn();
  let service: RedirectsService;

  beforeEach(() => {
    vi.clearAllMocks();
    repo.findOne.mockResolvedValue(null);
    service = new RedirectsService(
      { getRepository: () => repo } as unknown as DataSource,
      { revalidate } as unknown as RevalidationService,
    );
  });

  const input = {
    source: '/Old',
    target: '/about',
    type: 'permanent',
    enabled: true,
    note: ' ',
  } as const;

  it('saves a normalised redirect and refreshes the website routes', async () => {
    const created = await service.create(input);
    expect(created).toMatchObject({ source: '/old', target: '/about', note: null });
    expect(revalidate).toHaveBeenCalledWith(['routes']);
  });

  it('rejects self-redirects, duplicates and chains', async () => {
    await expect(service.create({ ...input, target: '/old/' })).rejects.toMatchObject({
      status: 400,
    });
    repo.findOne.mockResolvedValueOnce({ id: 'other' });
    await expect(service.create(input)).rejects.toMatchObject({ status: 409 });
    repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'chain' });
    await expect(service.create(input)).rejects.toMatchObject({ status: 400 });
  });
});
