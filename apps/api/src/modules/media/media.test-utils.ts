import { vi } from 'vitest';
import { EXT_BY_MIME } from '../../shared/upload-options';

/**
 * MediaService stand-in for controller tests: uploads go to the given `put` spy under
 * `<folder>/<hex>.<ext>` (the real key layout), and library URLs are accepted.
 */
export function mediaMock(s3: { put: (key: string, body: Buffer, type: string) => unknown }) {
  return {
    storeUrl: vi.fn(async (file: { buffer: Buffer; mimetype: string }, folder: string) =>
      s3.put(`${folder}/0193abcdef.${EXT_BY_MIME[file.mimetype]}`, file.buffer, file.mimetype),
    ),
    assertInLibrary: vi.fn(async () => undefined),
    deleteIfUnused: vi.fn(async () => undefined),
  };
}
