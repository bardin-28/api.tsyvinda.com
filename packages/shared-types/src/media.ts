/** Where an image of the media library is used. */
export interface MediaUsage {
  kind: 'post' | 'user' | 'page';
  /** Post id, user id or page key */
  id: string;
  /** Post title, user name or page name, for the admin panel */
  label: string;
}

/**
 * An image of the media library (`/admin/media`). Every upload is registered here and can be
 * reused by any image field; a file nobody uses any more is deleted with its row.
 */
export interface AdminMedia {
  id: string;
  url: string;
  /** Original file name (null for images imported from existing content) */
  fileName: string | null;
  mimeType: string | null;
  /** Bytes; null when unknown */
  size: number | null;
  createdAt: string;
  uploadedBy: { id: string; name: string } | null;
  usages: MediaUsage[];
}
