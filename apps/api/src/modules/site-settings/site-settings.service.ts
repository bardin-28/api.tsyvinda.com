import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, type Repository } from 'typeorm';
import type { SiteSettings, SiteSettingsUpdate } from '@tsyvinda/shared-types';
import { SITE_SETTINGS_ROW_ID, SiteSettingsRow } from './entities/site-settings.entity';

/** Used until the row exists (fresh database before the first save). */
const DEFAULT_SETTINGS: SiteSettings = { indexingEnabled: true, updatedAt: null };

// Website-wide settings in a single row (id = 1). Read by the website (public endpoint) and
// edited in the admin panel; the row is created on first save if the migration didn't seed it.
@Injectable()
export class SiteSettingsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private get rows(): Repository<SiteSettingsRow> {
    return this.ds.getRepository(SiteSettingsRow);
  }

  async get(): Promise<SiteSettings> {
    const row = await this.rows.findOne({ where: { id: SITE_SETTINGS_ROW_ID } });
    return row ? toSiteSettings(row) : DEFAULT_SETTINGS;
  }

  async update(patch: SiteSettingsUpdate): Promise<SiteSettings> {
    const row =
      (await this.rows.findOne({ where: { id: SITE_SETTINGS_ROW_ID } })) ??
      this.rows.create({ id: SITE_SETTINGS_ROW_ID });
    row.indexingEnabled = patch.indexingEnabled;
    return toSiteSettings(await this.rows.save(row));
  }
}

function toSiteSettings(row: SiteSettingsRow): SiteSettings {
  return { indexingEnabled: row.indexingEnabled, updatedAt: row.updatedAt.toISOString() };
}
