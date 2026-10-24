import { describe, it, expect } from 'vitest';
import { toPostPayload } from './postPayload';
import { slugify } from './slugify';

const base = { title: 'Hello', slug: 'hello', description: 'Sum', htmlContent: '<p>Hi</p>' };

describe('toPostPayload', () => {
  it('keeps an unchanged cover out of the body', () => {
    expect(
      toPostPayload({ ...base, imageUrl: 'https://cdn/x.png' }, { imageUrl: 'https://cdn/x.png' }),
    ).toEqual(base);
  });

  it('sends a newly picked file as image', () => {
    const picked = { rawFile: new File(['x'], 'c.png', { type: 'image/png' }), src: 'blob:x' };
    expect(toPostPayload({ ...base, imageUrl: picked }).image).toBe(picked);
  });

  it('flags removeImage when the existing cover was cleared', () => {
    expect(toPostPayload({ ...base, imageUrl: null }, { imageUrl: 'https://cdn/x.png' })).toEqual({
      ...base,
      removeImage: true,
    });
  });

  it('sends a cleared description as an empty string', () => {
    expect(toPostPayload({ ...base, description: null }).description).toBe('');
  });

  it('never forwards read-only fields', () => {
    const payload = toPostPayload({ ...base, author: { id: 'u1' }, createdAt: 'x' } as never);
    expect(payload).not.toHaveProperty('author');
    expect(payload).not.toHaveProperty('createdAt');
  });
});

describe('slugify', () => {
  it('produces an API-valid slug', () => {
    expect(slugify('  Héllo, Wörld!  Part 2 ')).toBe('hello-world-part-2');
    expect(slugify('---')).toBe('');
  });
});
