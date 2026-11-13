import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';
import { SiteSettingsService } from './site-settings.service';
import type { SiteSettingsRow } from './entities/site-settings.entity';

let rows: {
  findOne: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
};
let service: SiteSettingsService;
const updatedAt = new Date('2026-11-13T10:00:00.000Z');

beforeEach(() => {
  rows = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn((row: Partial<SiteSettingsRow>) => ({ ...row })),
    save: vi.fn(async (row: SiteSettingsRow) => ({ ...row, updatedAt })),
  };
  service = new SiteSettingsService({ getRepository: () => rows } as unknown as DataSource);
});

describe('SiteSettingsService', () => {
  it('defaults to indexing on before the row exists', async () => {
    expect(await service.get()).toEqual({ indexingEnabled: true, updatedAt: null });
  });

  it('reads the stored row', async () => {
    rows.findOne.mockResolvedValue({ id: 1, indexingEnabled: false, updatedAt });
    expect(await service.get()).toEqual({
      indexingEnabled: false,
      updatedAt: '2026-11-13T10:00:00.000Z',
    });
  });

  it('updates the existing row', async () => {
    rows.findOne.mockResolvedValue({ id: 1, indexingEnabled: true, updatedAt });
    const result = await service.update({ indexingEnabled: false });
    expect(rows.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, indexingEnabled: false }),
    );
    expect(rows.create).not.toHaveBeenCalled();
    expect(result.indexingEnabled).toBe(false);
  });

  it('creates the row on first save when it is missing', async () => {
    await service.update({ indexingEnabled: false });
    expect(rows.create).toHaveBeenCalledWith({ id: 1 });
    expect(rows.save).toHaveBeenCalledWith({ id: 1, indexingEnabled: false });
  });
});
