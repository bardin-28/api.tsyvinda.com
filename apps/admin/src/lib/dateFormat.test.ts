import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime } from './dateFormat';

// Local-time constructor so the expectations hold in any test timezone.
const sample = new Date(2026, 7, 7, 21, 8, 5);

describe('dateFormat', () => {
  it('formats dates as dd.mm.yyyy', () => {
    expect(formatDate(sample)).toBe('07.08.2026');
    expect(formatDate(sample.toISOString())).toBe('07.08.2026');
  });

  it('formats timestamps as hh:mm:ss • dd.mm.yyyy', () => {
    expect(formatDateTime(sample)).toBe('21:08:05 • 07.08.2026');
  });

  it('returns an empty string for missing or invalid input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDateTime('not a date')).toBe('');
  });
});
