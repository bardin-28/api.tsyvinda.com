// Admin-wide date formats (reference layout): dates as 07.08.2026, timestamps as
// 21:18:22 • 07.08.2026. Local time, 24-hour clock.

type DateInput = string | number | Date | null | undefined;

const pad = (value: number): string => String(value).padStart(2, '0');

const toDate = (value: DateInput): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** `07.08.2026`; empty string for a missing/invalid date. */
export function formatDate(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '';
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** `21:18:22 • 07.08.2026`; empty string for a missing/invalid date. */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '';
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${time} • ${formatDate(date)}`;
}
