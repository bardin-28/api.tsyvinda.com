import { randomBytes } from 'crypto';

/**
 * RFC 9562 UUID version 7: 48-bit Unix-millisecond timestamp, then random bits. Time-ordered,
 * so ids (and S3 keys) sort by creation and index well. Database rows get theirs from
 * Postgres 18's `uuidv7()` column default (see `PrimaryUuidV7Column`); this is for ids the app
 * makes itself, e.g. object keys and request ids.
 */
export function uuidv7(now: number = Date.now()): string {
  const bytes = randomBytes(16);
  // 48-bit big-endian millisecond timestamp
  bytes[0] = Math.floor(now / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(now / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(now / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(now / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 9562 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
