import { describe, it, expect } from 'vitest';
import type { FieldDefinitions } from '@tsyvinda/shared-types';
import {
  flattenFieldValues,
  missingRequiredFields,
  normalizeFieldValues,
  referencedPageKeys,
  type FieldErrors,
} from './field-values';

const defs = {
  title: { kind: 'text', localized: true, label: 'Title', required: true, max: 10 },
  org: { kind: 'text', localized: false, label: 'Org' },
  chips: { kind: 'strings', localized: false, label: 'Chips' },
  bullets: { kind: 'strings', localized: true, label: 'Bullets' },
  body: { kind: 'richText', label: 'Body' },
  count: { kind: 'number', label: 'Count', min: 1, max: 5 },
  date: { kind: 'date', label: 'Date' },
  flag: { kind: 'boolean', label: 'Flag' },
  link: { kind: 'pageLink', label: 'Link' },
  rows: {
    kind: 'list',
    label: 'Rows',
    itemLabel: 'Row',
    item: { name: { kind: 'text', localized: true, label: 'Name', required: true } },
  },
} as const satisfies FieldDefinitions;

function normalize(values: unknown) {
  const errors: FieldErrors = {};
  return { values: normalizeFieldValues(defs, values, '', errors), errors };
}

describe('normalizeFieldValues', () => {
  it('fills every field and language, trims text and drops unknown keys', () => {
    const { values, errors } = normalize({
      title: { en: '  Hi ' },
      chips: ['a', ' ', 'b'],
      unknown: 'x',
    });
    expect(errors).toEqual({});
    expect(values).toEqual({
      title: { en: 'Hi', uk: '' },
      org: '',
      chips: ['a', 'b'],
      bullets: { en: [], uk: [] },
      body: { en: '', uk: '' },
      count: null,
      date: null,
      flag: false,
      link: null,
      rows: [],
    });
  });

  it('collects type and range errors by path', () => {
    const { errors } = normalize({
      title: { en: 'far too long title' },
      count: 9,
      date: '13.11.2026',
      link: 'nowhere',
      rows: [{ name: 'not localized' }],
    });
    expect(errors).toEqual({
      'title.en': 'At most 10 characters',
      count: 'At most 5',
      date: 'Must be a date (YYYY-MM-DD)',
      link: 'Unknown page',
      'rows.0.name': 'Must have one value per language (en, uk)',
    });
  });

  it('sanitizes rich text, keeping page links and securing external ones', () => {
    const { values } = normalize({
      body: {
        en: '<p onclick="x()">Hi <script>alert(1)</script><a href="page:about">me</a> <a href="https://x.dev">x</a> <a href="javascript:alert(1)">bad</a></p>',
      },
    });
    expect((values.body as { en: string }).en).toBe(
      '<p>Hi <a href="page:about">me</a> <a href="https://x.dev" target="_blank" rel="noopener noreferrer">x</a> <a>bad</a></p>',
    );
  });
});

describe('missingRequiredFields', () => {
  it('reports empty required fields per enabled language, inside lists too', () => {
    const { values } = normalize({ title: { en: 'Hi' }, rows: [{ name: { uk: 'Ім’я' } }] });
    expect(missingRequiredFields(defs, values, ['en', 'uk'])).toEqual([
      'title.uk',
      'rows.0.name.en',
    ]);
    expect(missingRequiredFields(defs, values, ['en'])).toEqual(['rows.0.name.en']);
  });
});

describe('flattenFieldValues', () => {
  it('returns one language and resolves page links', () => {
    const { values } = normalize({
      title: { en: 'Hi', uk: 'Привіт' },
      bullets: { uk: ['один'] },
      body: { uk: '<p><a href="page:about#stack">про</a> <a href="page:blog">блог</a></p>' },
      link: 'about',
      rows: [{ name: { uk: 'Рядок' } }],
    });
    const flat = flattenFieldValues(defs, values, {
      locale: 'uk',
      pagePath: (key) => (key === 'about' ? '/pro-mene' : null),
      publicPath: (key) => (key === 'about' ? '/uk/pro-mene' : null),
    });
    expect(flat).toMatchObject({
      title: 'Привіт',
      bullets: ['один'],
      body: '<p><a href="/uk/pro-mene#stack">про</a> <a href="#">блог</a></p>',
      link: { key: 'about', path: '/pro-mene' },
      rows: [{ name: 'Рядок' }],
    });
  });

  it('lists the pages the values link to', () => {
    const { values } = normalize({ link: 'contacts', body: { en: '<a href="page:about">a</a>' } });
    expect(referencedPageKeys(defs, values).sort()).toEqual(['about', 'contacts']);
  });
});
