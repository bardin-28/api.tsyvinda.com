import { describe, it, expect } from 'vitest';
import { isUUID } from 'class-validator';
import { uuidv7 } from './uuid-v7';

describe('uuidv7', () => {
  it('produces a valid version-7, RFC-variant UUID', () => {
    const id = uuidv7();
    expect(isUUID(id)).toBe(true);
    expect(id[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });

  it('encodes the millisecond timestamp in the first 48 bits', () => {
    const now = Date.UTC(2026, 10, 13, 12, 0, 0, 123);
    const id = uuidv7(now);
    const timestamp = parseInt(id.replace(/-/g, '').slice(0, 12), 16);
    expect(timestamp).toBe(now);
  });

  it('sorts by creation time', () => {
    const earlier = uuidv7(1_700_000_000_000);
    const later = uuidv7(1_700_000_000_001);
    expect(earlier < later).toBe(true);
  });

  it('is random within the same millisecond', () => {
    expect(uuidv7(1)).not.toBe(uuidv7(1));
  });
});
