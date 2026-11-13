import { describe, it, expect } from 'vitest';
import { layoutTextBlocks, wrapText } from './coverPaint';
import { coverFileName, getSizePreset, COVER_SIZES } from './coverConfig';
import { coverGeneratorPath } from '../../resources/resources.config';

// 10px per character keeps widths easy to reason about.
const measuringContext = {
  measureText: (text: string) => ({ width: text.length * 10 }) as TextMetrics,
};

describe('wrapText', () => {
  it('breaks words onto new lines once the max width is exceeded', () => {
    const lines = wrapText(measuringContext, 'one two three four', 90);
    expect(lines.map((line) => line.text)).toEqual(['one two', 'three', 'four']);
    expect(lines[0]?.width).toBe(70);
  });

  it('keeps a single over-long word on its own line', () => {
    expect(wrapText(measuringContext, 'supercalifragilistic', 50)).toEqual([
      { text: 'supercalifragilistic', width: 200 },
    ]);
  });

  it('returns no lines for blank text', () => {
    expect(wrapText(measuringContext, '   ', 100)).toEqual([]);
  });
});

describe('cover config', () => {
  it('names files after the title slug, with a fallback', () => {
    expect(coverFileName('Hello, World! 2026')).toBe('hello-world-2026.jpg');
    expect(coverFileName('!!!')).toBe('blog-cover.jpg');
  });

  it('falls back to the first size preset', () => {
    expect(getSizePreset('wide')).toMatchObject({ width: 1920, height: 1080 });
    expect(getSizePreset('unknown' as never)).toBe(COVER_SIZES[0]);
  });

  it('builds the generator path with an encoded post id', () => {
    expect(coverGeneratorPath()).toBe('/blog/cover');
    expect(coverGeneratorPath('a b')).toBe('/blog/cover?postId=a%20b');
  });
});

describe('layoutTextBlocks', () => {
  const line = { text: 'x', width: 10 };

  it('starts every block below the previous one and centers the stack', () => {
    const small = { lines: [line], size: 20, gap: 22 };
    const title = { lines: [line, line], size: 80, gap: 86 };
    const subtitle = { lines: [line], size: 30, gap: 42 };

    const [first, second, third] = layoutTextBlocks([small, title, subtitle], 630);

    // stack height: 22 + 11 + 172 + 44 + 42 = 291 → top = round((630 - 291) / 2) = 170
    expect(first?.firstBaselineY).toBe(170 + 17);
    // title top = 170 + 22 + 11 = 203; its ascent clears the block above
    expect(second?.firstBaselineY).toBe(203 + 68);
    // subtitle top = 203 + 172 + 44 = 419
    expect(third?.firstBaselineY).toBe(419 + 26);
  });

  it('returns nothing for no blocks', () => {
    expect(layoutTextBlocks([], 630)).toEqual([]);
  });
});
