/** Website-wide settings edited in the admin panel (Settings → General). */
export interface SiteSettings {
  /**
   * On: pages are indexed as usual. Off: every website page answers with
   * `X-Robots-Tag: noindex, nofollow` and the sitemap is empty.
   */
  indexingEnabled: boolean;
  /** Last change; null until the settings are first saved */
  updatedAt: string | null;
}

export type SiteSettingsUpdate = Pick<SiteSettings, 'indexingEnabled'>;
