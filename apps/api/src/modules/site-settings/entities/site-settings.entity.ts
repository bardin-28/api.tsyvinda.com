import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Single-row table: the website's global settings live in the row with id = 1. */
export const SITE_SETTINGS_ROW_ID = 1;

@Entity('site_settings')
export class SiteSettingsRow {
  @PrimaryColumn({ type: 'smallint' })
  id: number;

  /** On by default: the live site was indexed before this setting existed */
  @Column({ type: 'boolean', default: true })
  indexingEnabled: boolean;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
