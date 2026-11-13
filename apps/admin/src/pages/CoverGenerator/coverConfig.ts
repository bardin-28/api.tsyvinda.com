import { fontFamily } from '../../theme';
import { slugify } from '../../resources/posts/slugify';

// Ported from the website's /blog/cover generator (fe `src/app/blog/cover/const`).
// Covers are website artwork, so they keep the website brand (orange), not the admin purple.

export type CoverSizeId = 'og' | 'wide';

export interface CoverSizePreset {
  id: CoverSizeId;
  label: string;
  width: number;
  height: number;
}

const OG_SIZE: CoverSizePreset = { id: 'og', label: 'OG 1200×630', width: 1200, height: 630 };

export const COVER_SIZES: CoverSizePreset[] = [
  OG_SIZE,
  { id: 'wide', label: '16:9 1920×1080', width: 1920, height: 1080 },
];

export type CoverAlignment = 'left' | 'center' | 'right';

// No eyebrow (and so no accent color, which only styled the eyebrow), unlike the website tool.
export interface CoverState {
  title: string;
  subtitle: string;
  sizeId: CoverSizeId;
  alignment: CoverAlignment;
  titleScale: number;
  vignette: boolean;
  showSubtitle: boolean;
}

export const DEFAULT_COVER: CoverState = {
  title: 'Notes on building software',
  subtitle: 'Frontend engineering, React, Next.js, TypeScript, and product delivery.',
  sizeId: 'wide',
  alignment: 'left',
  titleScale: 1,
  vignette: true,
  showSubtitle: true,
};

export const TITLE_SCALE = { min: 0.6, max: 1.5, step: 0.05 } as const;

export const TEXT_LIMITS = { title: 140, subtitle: 220 } as const;

export const SCENE_BG_COLOR = '#080810';

// The website renders covers in Roboto; it is used when installed, else the admin system stack.
export const COVER_FONT_FAMILY = `Roboto, ${fontFamily}`;

export const COVER_JPEG_QUALITY = 0.92;

/** Query param that opens the generator for one post, e.g. from the post edit page. */
export const COVER_POST_ID_PARAM = 'postId';

export function getSizePreset(id: CoverSizeId): CoverSizePreset {
  return COVER_SIZES.find((preset) => preset.id === id) ?? OG_SIZE;
}

/** Download / upload file name for a cover, e.g. `notes-on-building-software.jpg`. */
export function coverFileName(title: string): string {
  return `${slugify(title) || 'blog-cover'}.jpg`;
}
