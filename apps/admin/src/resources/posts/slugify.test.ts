import { describe, expect, it } from 'vitest';
import { slugify, transliterateUkrainian } from './slugify';

describe('transliterateUkrainian', () => {
  it('follows the 2010 national system, word-start forms included', () => {
    expect(transliterateUkrainian('Щастя')).toBe('shchastia');
    expect(transliterateUkrainian('Юрій Їжакевич')).toBe('yurii yizhakevych');
    expect(transliterateUkrainian('Згорани')).toBe('zghorany');
    expect(transliterateUkrainian("Знам'янка")).toBe('znamianka');
    expect(transliterateUkrainian('Ґанок')).toBe('ganok');
  });
});

describe('slugify', () => {
  it('turns Ukrainian titles into Latin slugs', () => {
    expect(slugify('Епоха WordPress завершилася')).toBe('epokha-wordpress-zavershylasia');
    expect(slugify('Корпоративна ШІ-пастка: як Anthropic привʼязує вас до себе')).toBe(
      'korporatyvna-shi-pastka-yak-anthropic-pryviazuie-vas-do-sebe',
    );
  });

  it('keeps English titles as before', () => {
    expect(slugify('Next.js vs. Pure React: When?')).toBe('next-js-vs-pure-react-when');
    expect(slugify('Café déjà vu')).toBe('cafe-deja-vu');
  });
});
