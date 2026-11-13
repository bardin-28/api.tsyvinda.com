import { describe, it, expect } from 'vitest';
import {
  INITIAL_TRANSFORM,
  MAX_ZOOM,
  clampOffset,
  coverScale,
  normalizeTransform,
  outputSize,
} from './imageCrop';

const landscape = { width: 2000, height: 1000 };
const square = { width: 400, height: 400 };

describe('coverScale', () => {
  it('fits the shorter side of the image to the frame', () => {
    expect(coverScale(landscape, square, 0)).toBe(0.4);
    expect(coverScale({ width: 1000, height: 2000 }, square, 0)).toBe(0.4);
  });

  it('needs a larger scale when rotated so no corner shows', () => {
    const rotated = coverScale(square, square, Math.PI / 4);
    expect(rotated).toBeCloseTo(Math.SQRT2, 5);
  });

  it('swaps the sides for a quarter turn', () => {
    expect(coverScale(landscape, { width: 400, height: 200 }, Math.PI / 2)).toBe(0.4);
  });
});

describe('clampOffset', () => {
  it('lets the image move only as far as it extends past the frame', () => {
    // Scale 0.4 → image 800×400 on a 400×400 frame: 200 px of slack each way horizontally
    const transform = { ...INITIAL_TRANSFORM };
    expect(clampOffset({ x: 500, y: 50 }, landscape, square, transform)).toEqual({ x: 200, y: 0 });
    expect(clampOffset({ x: -120, y: 0 }, landscape, square, transform)).toEqual({ x: -120, y: 0 });
  });

  it('allows more movement when zoomed in', () => {
    const offset = clampOffset({ x: 0, y: 999 }, landscape, square, {
      ...INITIAL_TRANSFORM,
      zoom: 2,
    });
    expect(offset.y).toBeCloseTo(200, 5);
  });
});

describe('normalizeTransform', () => {
  it('keeps zoom, straighten and quarter turns in range', () => {
    const next = normalizeTransform(
      { ...INITIAL_TRANSFORM, zoom: 10, straighten: 90, quarterTurns: -1 },
      landscape,
      square,
    );
    expect(next).toMatchObject({ zoom: MAX_ZOOM, straighten: 45, quarterTurns: 3 });
  });
});

describe('outputSize', () => {
  it('uses the field width in the frame aspect', () => {
    expect(outputSize({ width: 4000, height: 4000 }, square, INITIAL_TRANSFORM, 640)).toEqual({
      width: 640,
      height: 640,
    });
  });

  it('never upscales a small source', () => {
    // A 300 px wide square covers the frame at scale 400/300: the frame holds 300 source px
    expect(outputSize({ width: 300, height: 300 }, square, INITIAL_TRANSFORM, 640)).toEqual({
      width: 300,
      height: 300,
    });
    // Zoomed ×2 it holds half of them
    expect(
      outputSize({ width: 300, height: 300 }, square, { ...INITIAL_TRANSFORM, zoom: 2 }, 640),
    ).toEqual({ width: 150, height: 150 });
  });
});
