import { describe, it, expect } from 'vitest';
import { toPostPayload, type PostFormValues } from './postPayload';

const base: PostFormValues = {
  title: 'Hello',
  slug: 'hello',
  description: 'Lead',
  htmlContent: '<p>Hi</p>',
};
const none = { imageUrl: null, ogImageUrl: null };
const file = new File(['x'], 'a.png', { type: 'image/png' });

describe('toPostPayload', () => {
  it('sends content, empty overrides as "" and a draft by default', () => {
    expect(toPostPayload(base, none)).toEqual({
      title: 'Hello',
      slug: 'hello',
      description: 'Lead',
      htmlContent: '<p>Hi</p>',
      coverAlt: '',
      categoryIds: [],
      status: 'draft',
      publishedAt: '',
      seoTitle: '',
      seoDescription: '',
      keywords: [],
      localizedSlug: '',
      canonicalUrl: '',
    });
  });

  it("sends keywords as a clean list and this language's own URL", () => {
    expect(
      toPostPayload(
        { ...base, keywords: ' Next.js, , security ,API ', localizedSlug: 'pryvit' },
        none,
      ),
    ).toMatchObject({ keywords: ['Next.js', 'security', 'API'], localizedSlug: 'pryvit' });
    expect(toPostPayload({ ...base, keywords: ['React'] }, none)).toMatchObject({
      keywords: ['React'],
    });
  });

  it('sends publishing, author, ordered categories and SEO fields', () => {
    const payload = toPostPayload(
      {
        ...base,
        status: 'published',
        publishedAt: new Date('2026-08-07T10:00:00.000Z'),
        authorId: 'u1',
        categoryIds: ['c2', 'c1'],
        seoTitle: 'SEO',
        canonicalUrl: 'https://example.com/a',
        coverAlt: 'Knot',
      },
      none,
    );
    expect(payload).toMatchObject({
      status: 'published',
      publishedAt: '2026-08-07T10:00:00.000Z',
      authorId: 'u1',
      categoryIds: ['c2', 'c1'],
      seoTitle: 'SEO',
      canonicalUrl: 'https://example.com/a',
      coverAlt: 'Knot',
    });
  });

  it('leaves the author out when empty (API defaults to the signed-in admin)', () => {
    expect(toPostPayload({ ...base, authorId: null }, none)).not.toHaveProperty('authorId');
  });

  it('sends newly picked cover and social images as files', () => {
    const payload = toPostPayload(
      { ...base, imageUrl: { rawFile: file }, ogImageUrl: { rawFile: file } },
      none,
    );
    expect(payload.image).toEqual({ rawFile: file });
    expect(payload.ogImage).toEqual({ rawFile: file });
  });

  it('uses the cover as OG image when ticked: no upload, stored OG image dropped', () => {
    const previous = { imageUrl: 'https://cdn/a.png', ogImageUrl: 'https://cdn/og.png' };
    const payload = toPostPayload(
      { ...base, ogImageUrl: { rawFile: file }, useCoverAsOgImage: true },
      previous,
    );
    expect(payload).not.toHaveProperty('ogImage');
    expect(payload).toMatchObject({ removeOgImage: true });
    expect(toPostPayload({ ...base, useCoverAsOgImage: true }, none)).not.toHaveProperty(
      'removeOgImage',
    );
  });

  it('uploads a dedicated OG image when unticked', () => {
    const payload = toPostPayload(
      { ...base, ogImageUrl: { rawFile: file }, useCoverAsOgImage: false },
      none,
    );
    expect(payload.ogImage).toEqual({ rawFile: file });
  });

  it('asks to remove images that were cleared, keeps unchanged ones', () => {
    const previous = { imageUrl: 'https://cdn/a.png', ogImageUrl: 'https://cdn/og.png' };
    expect(
      toPostPayload({ ...base, imageUrl: null, ogImageUrl: 'https://cdn/og.png' }, previous),
    ).toMatchObject({ removeImage: true });
    expect(
      toPostPayload({ ...base, imageUrl: 'https://cdn/a.png', ogImageUrl: null }, previous),
    ).toMatchObject({ removeOgImage: true });
    const unchanged = toPostPayload(
      { ...base, imageUrl: 'https://cdn/a.png', ogImageUrl: 'https://cdn/og.png' },
      previous,
    );
    expect(unchanged).not.toHaveProperty('removeImage');
    expect(unchanged).not.toHaveProperty('image');
  });

  it('sends images picked from the media library as their URL', () => {
    const previous = { imageUrl: 'https://cdn/a.png', ogImageUrl: null };
    const payload = toPostPayload(
      { ...base, imageUrl: 'https://cdn/media/b.webp', ogImageUrl: 'https://cdn/media/og.webp' },
      previous,
    );
    expect(payload).toMatchObject({
      imageUrl: 'https://cdn/media/b.webp',
      ogImageUrl: 'https://cdn/media/og.webp',
    });
    expect(payload).not.toHaveProperty('removeImage');
  });
});
