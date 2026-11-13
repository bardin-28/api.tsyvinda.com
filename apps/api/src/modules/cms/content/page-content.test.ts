import { describe, it, expect } from 'vitest';
import { LOCALES, PAGE_KEYS, type PageContent } from '@tsyvinda/shared-types';
import { HttpError } from '../../../shared/http-error';
import { DEFAULT_PAGE_CONTENT } from '../seed/default-content';
import {
  emptyPageContent,
  translationProgress,
  missingRequired,
  normalizeEnabledLocales,
  normalizePageContent,
} from './page-content';

function fieldErrorsOf(run: () => unknown): Record<string, string> {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    return ((error as HttpError).details as { fieldErrors: Record<string, string> }).fieldErrors;
  }
  throw new Error('expected a validation error');
}

describe('normalizePageContent', () => {
  it('accepts every seeded page as complete in all languages', () => {
    for (const key of PAGE_KEYS) {
      const content = normalizePageContent(key, DEFAULT_PAGE_CONTENT[key]);
      expect(missingRequired(content, LOCALES), key).toEqual([]);
    }
  });

  it('always returns the page’s fixed sections, in order, with their anchors', () => {
    const content = normalizePageContent('about', {
      ...emptyPageContent(),
      blocks: [
        { type: 'homeHero', data: {} },
        { type: 'aboutStack', anchor: 'custom', data: { tag: '07' } },
        { type: 'nope', data: {} },
      ],
    });
    expect(content.blocks.map((block) => [block.type, block.anchor])).toEqual([
      ['aboutHero', null],
      ['aboutStack', 'stack'],
      ['aboutExperience', 'experience'],
      ['aboutRecommendations', 'recommendations'],
      ['aboutEducation', 'education'],
      ['ctaBanner', null],
    ]);
    // Matched by position and type: the stack keeps its data, the mismatched hero starts empty
    expect(content.blocks[1]!.data.tag).toBe('07');
    expect(content.blocks[0]!.data.headlineFirst).toEqual({ en: '', uk: '' });
  });

  it('accepts an uploaded image URL and refuses anything else', () => {
    const ok = normalizePageContent('home', {
      blocks: [{ type: 'homeHero', data: { avatar: 'https://cdn.example/pages/a.webp' } }],
    });
    expect(ok.blocks[0]!.data.avatar).toBe('https://cdn.example/pages/a.webp');
    expect(normalizePageContent('home', {}).blocks[0]!.data.avatar).toBeNull();
    const errors = fieldErrorsOf(() =>
      normalizePageContent('home', {
        blocks: [{ type: 'homeHero', data: { avatar: 'javascript:alert(1)' } }],
      }),
    );
    expect(errors).toEqual({ 'draft.blocks.0.data.avatar': 'Must be an uploaded image URL' });
  });

  it('validates fields inside groups', () => {
    const errors = fieldErrorsOf(() =>
      normalizePageContent('about', {
        blocks: [{ type: 'aboutHero', data: { industries: { items: 'MedTech' } } }],
      }),
    );
    expect(errors).toEqual({ 'draft.blocks.0.data.industries.items': 'Must be a list' });
  });

  it('keeps valid block ids and replaces missing or duplicate ones', () => {
    const id = '01930000-0000-7000-8000-000000000000';
    const content = normalizePageContent('contacts', {
      blocks: [
        { id, type: 'contactsHero', data: {} },
        { id, type: 'contactChannels', data: {} },
      ],
    });
    expect(content.blocks[0]!.id).toBe(id);
    expect(content.blocks[1]!.id).not.toBe(id);
  });

  it('accepts only https share images', () => {
    const errors = fieldErrorsOf(() =>
      normalizePageContent('about', { seo: { ogImageUrl: 'http://x.dev/a.png' } }),
    );
    expect(errors).toEqual({ 'draft.seo.ogImageUrl': 'Must be an https URL' });
  });
});

describe('missingRequired', () => {
  it('needs the page name, SEO title and description in each language', () => {
    const content: PageContent = emptyPageContent();
    content.title.en = 'About';
    expect(missingRequired(content, ['en'])).toEqual([
      'draft.seo.title.en',
      'draft.seo.description.en',
    ]);
  });
});

describe('translationProgress', () => {
  it('is 100% per language for a seeded page and drops for a missing translation', () => {
    const content = normalizePageContent('contacts', DEFAULT_PAGE_CONTENT.contacts);
    expect(translationProgress(content)).toEqual({ en: 100, uk: 100 });
    content.title.uk = '';
    const progress = translationProgress(content);
    expect(progress.en).toBe(100);
    expect(progress.uk).toBeLessThan(100);
  });
});

describe('normalizeEnabledLocales', () => {
  it('keeps known languages in canonical order and needs at least one', () => {
    expect(normalizeEnabledLocales(['uk', 'en', 'uk', 'de'])).toEqual(['en', 'uk']);
    expect(() => normalizeEnabledLocales([])).toThrow(HttpError);
  });
});
