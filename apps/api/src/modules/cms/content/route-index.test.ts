import { describe, it, expect } from 'vitest';
import { RouteIndex, normalizeRequestPath } from './route-index';

const index = new RouteIndex([
  { key: 'home', publishedLocales: ['en', 'uk'], slugs: {} },
  { key: 'about', publishedLocales: ['en', 'uk'], slugs: { en: 'about', uk: 'pro-mene' } },
  { key: 'blog', publishedLocales: ['en'], slugs: { en: 'blog', uk: 'blog' } },
  { key: 'contacts', publishedLocales: [], slugs: { en: 'contacts' } },
]);

describe('RouteIndex', () => {
  it('computes published paths per language', () => {
    expect(index.path('home', 'uk')).toBe('/');
    expect(index.paths('about')).toEqual({ en: '/about', uk: '/pro-mene' });
    expect(index.paths('blog')).toEqual({ en: '/blog' });
    expect(index.publicPath('about', 'uk')).toBe('/uk/pro-mene');
    expect(index.publicPath('blog', 'uk')).toBeNull();
  });

  it('includes unpublished pages only for drafts', () => {
    expect(index.paths('contacts')).toEqual({});
    expect(index.paths('contacts', { draft: true })).toEqual({ en: '/contacts' });
  });

  it('builds the route map of published pages and finds a page by path', () => {
    expect(index.routeMap()).toEqual({
      home: { en: '/', uk: '/' },
      about: { en: '/about', uk: '/pro-mene' },
      blog: { en: '/blog' },
    });
    expect(index.pageAt('/pro-mene', 'uk')).toBe('about');
    expect(index.pageAt('/pro-mene', 'en')).toBeNull();
  });
});

describe('normalizeRequestPath', () => {
  it('decodes, lowercases and trims slashes', () => {
    expect(normalizeRequestPath('/About//Team/')).toBe('/about/team');
    expect(normalizeRequestPath('/%D0%BF%D1%80%D0%BE')).toBe('/про');
    expect(normalizeRequestPath('/')).toBe('/');
  });

  it('rejects undecodable and traversal paths', () => {
    expect(normalizeRequestPath('/%E0%A4%A')).toBeNull();
    expect(normalizeRequestPath('/a/../b')).toBeNull();
  });
});
