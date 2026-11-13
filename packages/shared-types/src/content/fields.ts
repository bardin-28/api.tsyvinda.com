import type { Locale } from '../locales';

/** One string per language, e.g. `{ en: 'About', uk: 'Про мене' }`. */
export type LocalizedText = Record<Locale, string>;

/** One list of strings per language (bullets, paragraphs, chips that are translated). */
export type LocalizedStrings = Record<Locale, string[]>;

/**
 * Field of a CMS block. Block definitions are trees of these; the API
 * validates drafts with them, the admin panel renders its forms from them and the website
 * gets each field flattened to one language (see `WebsiteFieldValue`).
 *
 * Stored (draft) value per kind:
 * - `text`      — `LocalizedText` when `localized`, else `string`
 * - `strings`   — `LocalizedStrings` when `localized`, else `string[]`
 * - `richText`  — `LocalizedText` holding sanitized HTML (links may use `page:<key>` hrefs)
 * - `number`    — `number`
 * - `date`      — `YYYY-MM-DD`
 * - `boolean`   — `boolean`
 * - `pageLink`  — a page key (`PageKey`)
 * - `image`     — public URL of an uploaded image (`string`), or null; same in every language
 * - `list`      — array of objects whose fields are `item`
 * - `group`     — one object whose fields are `fields` (a fixed sub-section, e.g. `industries.items`)
 */
export type FieldDefinition =
  | TextFieldDefinition
  | StringsFieldDefinition
  | RichTextFieldDefinition
  | NumberFieldDefinition
  | DateFieldDefinition
  | BooleanFieldDefinition
  | PageLinkFieldDefinition
  | ImageFieldDefinition
  | ListFieldDefinition
  | GroupFieldDefinition;

interface BaseFieldDefinition {
  label: string;
  /** Shown under the input in the admin panel */
  help?: string;
  /** Publishing is refused while a required field is empty in an enabled language */
  required?: boolean;
}

export interface TextFieldDefinition extends BaseFieldDefinition {
  kind: 'text';
  localized: boolean;
  multiline?: boolean;
  max?: number;
  /** Length search engines show well (e.g. SEO title 30–60); the admin counts characters against it */
  recommendedLength?: { min: number; max: number };
  /**
   * The website understands `<accent>…</accent>`, `<strong>…</strong>` and `<br></br>` in this
   * text (anything else is shown as typed).
   */
  markup?: boolean;
}

export interface StringsFieldDefinition extends BaseFieldDefinition {
  kind: 'strings';
  localized: boolean;
  max?: number;
}

export interface RichTextFieldDefinition extends BaseFieldDefinition {
  kind: 'richText';
}

export interface NumberFieldDefinition extends BaseFieldDefinition {
  kind: 'number';
  min?: number;
  max?: number;
}

export interface DateFieldDefinition extends BaseFieldDefinition {
  kind: 'date';
}

export interface BooleanFieldDefinition extends BaseFieldDefinition {
  kind: 'boolean';
}

export interface PageLinkFieldDefinition extends BaseFieldDefinition {
  kind: 'pageLink';
}

/** An image uploaded from the admin panel (`POST /admin/pages/uploads`); stored as its URL. */
export interface ImageFieldDefinition extends BaseFieldDefinition {
  kind: 'image';
  /** Crop in the admin panel before upload (fixed aspect, exported at most `outputWidth` wide) */
  crop?: ImageCropOptions;
}

export interface ImageCropOptions {
  /** Width / height of the result, e.g. 1 for a square */
  aspect: number;
  /** Max width of the exported file in px (never upscaled) */
  outputWidth: number;
  /** How the website shows it; `circle` adds a round guide to the crop frame */
  shape?: 'rect' | 'circle';
}

export interface ListFieldDefinition extends BaseFieldDefinition {
  kind: 'list';
  /** Label of one entry in the admin panel, e.g. "Role" */
  itemLabel: string;
  item: FieldDefinitions;
  max?: number;
}

/** Nested object of fields, edited inline (no add/remove); the website gets it as an object. */
export interface GroupFieldDefinition extends BaseFieldDefinition {
  kind: 'group';
  fields: FieldDefinitions;
}

export type FieldDefinitions = Record<string, FieldDefinition>;

/** Field values of a block as stored in a draft. */
export type FieldValues = Record<string, unknown>;

/** A `pageLink` field as the website receives it: the page and its path in that language. */
export interface WebsitePageLink {
  key: string;
  /** Unprefixed path in the requested language ("/about"); null while the page is unpublished */
  path: string | null;
}

/** Max length of a single-line text when the definition sets none. */
export const DEFAULT_TEXT_MAX = 300;
/** Max length of a multiline text / list entry when the definition sets none. */
export const DEFAULT_MULTILINE_MAX = 5000;
/** Max length of one rich text value (HTML). */
export const RICH_TEXT_MAX = 50_000;
/** Max entries of a list / strings field when the definition sets none. */
export const DEFAULT_LIST_MAX = 50;

/** Max length of an image URL. */
export const IMAGE_URL_MAX = 1024;

/** Href prefix of an internal link in rich text: `page:about` → the About page in that language. */
export const PAGE_LINK_HREF_PREFIX = 'page:';
