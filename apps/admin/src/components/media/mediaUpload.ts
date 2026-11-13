import { useState } from 'react';
import { useDataProvider, useNotify } from 'react-admin';
import type { AdminMedia } from '@tsyvinda/shared-types';

/** Types and size the API's upload accepts (shared/upload-options.ts). */
export const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp';
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;

/** "1.2 MB", "340 KB". */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Name shown for a library image: its original file name, else the last URL segment. */
export const mediaName = (media: Pick<AdminMedia, 'fileName' | 'url'>): string =>
  media.fileName ?? media.url.split('/').pop() ?? media.url;

/** Uploads files to the media library (`POST /admin/media`), one by one. */
export function useMediaUpload() {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (files: File[]): Promise<AdminMedia[]> => {
    const uploaded: AdminMedia[] = [];
    setIsUploading(true);
    try {
      for (const file of files) {
        if (file.size > MEDIA_MAX_BYTES) {
          notify(`${file.name} is larger than 5 MB`, { type: 'error' });
          continue;
        }
        try {
          const { data } = await dataProvider.create<AdminMedia>('media', {
            data: { image: { rawFile: file } },
          });
          uploaded.push(data);
        } catch (error) {
          notify(`${file.name}: ${(error as Error).message}`, { type: 'error' });
        }
      }
    } finally {
      setIsUploading(false);
    }
    return uploaded;
  };

  return { upload, isUploading };
}
