import type { FieldDefinitions, FieldValues } from './fields';

// ── Field helpers ───────────────────────────────────────────────────────────

const text = (label: string, extra: { required?: boolean; markup?: boolean; help?: string } = {}) =>
  ({ kind: 'text', localized: true, label, ...extra }) as const;
const longText = (
  label: string,
  extra: { required?: boolean; markup?: boolean; help?: string } = {},
) => ({ kind: 'text', localized: true, multiline: true, label, ...extra }) as const;
const plain = (label: string, extra: { required?: boolean; help?: string; max?: number } = {}) =>
  ({ kind: 'text', localized: false, label, ...extra }) as const;

/** Eyebrow number, title and lede that open most sections. */
const sectionHead = {
  tag: plain('Eyebrow', { help: 'Small label above the title, e.g. "01"', max: 10 }),
  title: text('Title', { required: true }),
  lede: longText('Lede'),
} as const;

/** Round portrait in the Home and About heroes. */
const heroPhoto = {
  kind: 'image',
  label: 'Photo',
  help: 'Jpeg, png or webp; cropped to a square (shown as a circle). The default photo when empty',
  crop: { aspect: 1, outputWidth: 640, shape: 'circle' },
} as const;

// ── Content groups ──────────────────────────────────────────────────────────

/**
 * Sub-sections a block keeps under one key (`data.experience.roles`). Each page holds its own
 * copy: content is not shared between pages.
 */
const industries = {
  kind: 'group',
  label: 'Industries',
  fields: {
    items: { kind: 'strings', localized: false, label: 'Industries', required: true },
  },
} as const;

const experience = {
  kind: 'group',
  label: 'Experience',
  fields: {
    roles: {
      kind: 'list',
      label: 'Roles',
      itemLabel: 'Role',
      required: true,
      item: {
        title: text('Job title', { required: true }),
        org: plain('Company', { required: true }),
        type: text('Employment type'),
        period: text('Period', { required: true }),
        location: text('Location'),
        bullets: { kind: 'strings', localized: true, label: 'Achievements' },
      },
    },
  },
} as const;

const recommendations = {
  kind: 'group',
  label: 'Recommendations',
  fields: {
    items: {
      kind: 'list',
      label: 'Recommendations',
      itemLabel: 'Recommendation',
      required: true,
      item: {
        name: text('Name', { required: true }),
        role: text('Role', { required: true }),
        relation: text('Relation'),
        quote: { kind: 'strings', localized: true, label: 'Quote paragraphs', required: true },
      },
    },
  },
} as const;

// ── Page blocks ─────────────────────────────────────────────────────────────

export interface BlockDefinition {
  label: string;
  description?: string;
  fields: FieldDefinitions;
}

/**
 * Every section type. The website renders one component per type; a page's fixed `sections`
 * (see pages.ts) say which of them it shows, in which order.
 */
export const BLOCK_DEFINITIONS = {
  // Home
  homeHero: {
    label: 'Home — hero',
    fields: {
      firstName: text('First name', { required: true }),
      lastName: text('Last name', { required: true }),
      rolePrimary: text('Role', { required: true }),
      roleSecondary: text('Role details'),
      avatar: heroPhoto,
      avatarAlt: text('Photo alt text', { required: true }),
      contactLabel: text('Main button', { required: true }),
      contactAriaLabel: text('Main button (screen readers)'),
      contactLink: { kind: 'pageLink', label: 'Main button opens', required: true },
      aboutLabel: text('Second button'),
      aboutLink: { kind: 'pageLink', label: 'Second button opens' },
      scrollLabel: text('Scroll hint'),
    },
  },
  homeAbout: {
    label: 'Home — about teaser',
    fields: { ...sectionHead, lead: longText('Text'), industries },
  },
  homeExperience: {
    label: 'Home — latest roles',
    fields: {
      ...sectionHead,
      count: { kind: 'number', label: 'Roles shown', min: 1, max: 10, required: true },
      seeAllLabel: text('Link text'),
      seeAllLink: { kind: 'pageLink', label: 'Link opens' },
      experience,
    },
  },
  homeRecommendation: {
    label: 'Home — featured recommendation',
    fields: {
      ...sectionHead,
      position: {
        kind: 'number',
        label: 'Recommendation shown',
        help: '1 = first in the list below',
        min: 1,
        max: 50,
        required: true,
      },
      recommendations,
    },
  },
  homeContact: {
    label: 'Home — contact',
    description: 'Contact channels (from the site configuration) and a button.',
    fields: {
      ...sectionHead,
      buttonLabel: text('Button'),
      buttonAriaLabel: text('Button (screen readers)'),
      buttonLink: { kind: 'pageLink', label: 'Button opens' },
    },
  },

  // About
  aboutHero: {
    label: 'About — hero',
    fields: {
      headlineFirst: text('Headline, first word', { required: true }),
      headlineSecond: text('Headline, second word'),
      lead: longText('Lead', { markup: true }),
      avatar: heroPhoto,
      avatarAlt: text('Photo alt text', { required: true }),
      industries,
    },
  },
  aboutStack: {
    label: 'About — stack',
    fields: {
      ...sectionHead,
      groups: {
        kind: 'list',
        label: 'Groups',
        itemLabel: 'Group',
        item: {
          name: text('Name', { required: true }),
          items: { kind: 'strings', localized: false, label: 'Tools', required: true },
        },
      },
    },
  },
  aboutExperience: {
    label: 'About — experience',
    fields: { ...sectionHead, experience },
  },
  aboutRecommendations: {
    label: 'About — recommendations',
    fields: { ...sectionHead, recommendations },
  },
  aboutEducation: {
    label: 'About — education',
    fields: {
      ...sectionHead,
      items: {
        kind: 'list',
        label: 'Schools',
        itemLabel: 'School',
        item: {
          school: text('School', { required: true }),
          degree: text('Degree'),
          period: text('Period'),
          skills: { kind: 'strings', localized: true, label: 'Skills' },
        },
      },
    },
  },
  ctaBanner: {
    label: 'Call to action',
    fields: {
      title: text('Title', { required: true }),
      text: longText('Text'),
      linkLabel: text('Button', { required: true }),
      link: { kind: 'pageLink', label: 'Button opens', required: true },
    },
  },

  // Contacts
  contactsHero: {
    label: 'Contacts — hero',
    fields: {
      title: text('Title', { required: true, markup: true }),
      lead: longText('Lead', { markup: true }),
      mapLabel: text('Map description (screen readers)'),
    },
  },
  contactChannels: {
    label: 'Contact channels',
    description: 'LinkedIn, Telegram, e-mail… from the site configuration.',
    fields: {},
  },

  // Blog
  blogHero: {
    label: 'Blog — hero',
    fields: {
      titleStart: text('Title', { required: true }),
      titleAccent: text('Title, highlighted part'),
      lead: longText('Lead'),
    },
  },
  blogFeed: {
    label: 'Blog — posts',
    description: 'Category filter and the list of published posts.',
    fields: {},
  },
  blogTopics: {
    label: 'Blog — topics',
    fields: {
      heading: text('Heading', { required: true }),
      intro: longText('Intro'),
      topics: {
        kind: 'list',
        label: 'Topics',
        itemLabel: 'Topic',
        item: {
          title: text('Title', { required: true }),
          description: longText('Description'),
        },
      },
    },
  },

  // Legal / generic
  legalHeader: {
    label: 'Document header',
    fields: {
      title: text('Title', { required: true }),
      lastUpdatedLabel: text('"Last updated" label'),
      updatedAt: { kind: 'date', label: 'Last updated', required: true },
    },
  },
  richText: {
    label: 'Text',
    fields: {
      heading: text('Heading'),
      html: { kind: 'richText', label: 'Text', required: true },
    },
  },
  cookieTable: {
    label: 'Cookie table',
    description: 'Every cookie the site sets; rows come from the website code.',
    fields: { heading: text('Heading'), intro: longText('Intro') },
  },
  cookieSettings: {
    label: 'Cookie settings button',
    fields: {
      heading: text('Heading'),
      text: longText('Text'),
      buttonLabel: text('Button', { required: true }),
    },
  },
} as const satisfies Record<string, BlockDefinition>;

export type BlockType = keyof typeof BLOCK_DEFINITIONS;
export const BLOCK_TYPES = Object.keys(BLOCK_DEFINITIONS) as BlockType[];

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === 'string' && Object.hasOwn(BLOCK_DEFINITIONS, value);
}

export function blockDefinition(type: BlockType): BlockDefinition {
  return BLOCK_DEFINITIONS[type];
}

/** A section of a page draft. */
export interface DraftBlock {
  /** Stable id (UUID) the website keys sections by */
  id: string;
  type: BlockType;
  /** `id` attribute of the rendered section (in-page links: `/about#stack`); fixed per page */
  anchor: string | null;
  data: FieldValues;
}

/** A section as the website receives it: every field in one language. */
export interface WebsiteBlock {
  id: string;
  type: BlockType;
  anchor: string | null;
  data: FieldValues;
}
