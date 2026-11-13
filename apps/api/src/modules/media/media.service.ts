import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ILike, In, type DataSource, type FindOptionsWhere } from 'typeorm';
import {
  PAGE_DEFINITIONS,
  isPageKey,
  type AdminMedia,
  type MediaUsage,
} from '@tsyvinda/shared-types';
import { HttpError } from '../../shared/http-error';
import { S3Service } from '../../shared/s3/s3.service';
import { extForMime } from '../../shared/upload-options';
import { uuidv7 } from '../../shared/uuid-v7';
import { Page } from '../cms/entities/page.entity';
import { PostTranslation } from '../posts/entities/post-translation.entity';
import { User } from '../users/entities/user.entity';
import { Media } from './entities/media.entity';

/** A file received by multer (memory storage). */
export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  size?: number;
}

/** S3 folders per kind of image (kept from before the library existed). */
export type MediaFolder = 'posts' | 'posts/og' | 'profile' | 'pages' | 'media';

const isString = (value: unknown): value is string => typeof value === 'string' && value !== '';

const toEditor = (user: User | null | undefined) =>
  user ? { id: user.id, name: `${user.firstName} ${user.lastName}`.trim() } : null;

/**
 * The media library: stores uploads (S3 + a `media` row) and knows where every image is used —
 * post language versions (cover, share image), user avatars and page content. Files are deleted
 * only when nothing uses them any more, checked across all of those, so an image reused by
 * several posts, pages or users is never removed from under one of them.
 */
@Injectable()
export class MediaService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly s3: S3Service,
  ) {}

  /** Uploads a file and registers it in the library. */
  async store(file: UploadedImage, folder: MediaFolder, uploadedById?: string): Promise<Media> {
    const url = await this.s3.put(
      `${folder}/${uuidv7()}.${extForMime(file.mimetype)}`,
      file.buffer,
      file.mimetype,
    );
    return this.ds.getRepository(Media).save(
      this.ds.getRepository(Media).create({
        url,
        fileName: file.originalname?.slice(0, 255) || null,
        mimeType: file.mimetype,
        size: file.size ?? file.buffer.length,
        uploadedById: uploadedById ?? null,
      }),
    );
  }

  /** Uploads a file and returns its URL (for fields that store URLs). */
  async storeUrl(file: UploadedImage, folder: MediaFolder, uploadedById?: string): Promise<string> {
    return (await this.store(file, folder, uploadedById)).url;
  }

  /**
   * An image picked from the library for a field: must be a library URL (no arbitrary
   * external URLs end up in content through this path). 400 otherwise.
   */
  async assertInLibrary(url: string, field: string): Promise<void> {
    if (!(await this.ds.getRepository(Media).exists({ where: { url } }))) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'Pick an image from the media library', {
        fieldErrors: { [field]: 'Not in the media library' },
      });
    }
  }

  /** Where an image is used (post versions, avatars, page content). */
  async usages(url: string): Promise<MediaUsage[]> {
    const [translations, users, pages] = await Promise.all([
      this.ds.getRepository(PostTranslation).find({
        where: [{ imageUrl: url }, { ogImageUrl: url }],
        select: { postId: true, title: true, locale: true },
      }),
      this.ds.getRepository(User).find({
        where: { profileImageUrl: url },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.pagesUsing(url),
    ]);
    const posts = new Map<string, string>();
    for (const version of translations) {
      if (!posts.has(version.postId) || version.locale === 'en') {
        posts.set(version.postId, version.title);
      }
    }
    return [
      ...[...posts].map(([id, label]) => ({ kind: 'post' as const, id, label })),
      ...users.map((user) => ({
        kind: 'user' as const,
        id: user.id,
        label: `${user.firstName} ${user.lastName}`.trim(),
      })),
      ...pages.map((key) => ({
        kind: 'page' as const,
        id: key,
        label: isPageKey(key) ? PAGE_DEFINITIONS[key].label : key,
      })),
    ];
  }

  async isUsed(url: string): Promise<boolean> {
    const [translation, user, pages] = await Promise.all([
      this.ds.getRepository(PostTranslation).exists({
        where: [{ imageUrl: url }, { ogImageUrl: url }],
      }),
      this.ds.getRepository(User).exists({ where: { profileImageUrl: url } }),
      this.pagesUsing(url),
    ]);
    return translation || user || pages.length > 0;
  }

  /**
   * Deletes the images nothing uses any more (file + library row). Call after the change that
   * dropped them is saved. Only files in our bucket are touched; best-effort like before.
   */
  async deleteIfUnused(urls: (string | null | undefined)[]): Promise<void> {
    const candidates = [...new Set(urls.filter(isString))].filter((url) =>
      Boolean(this.s3.keyFromUrl(url)),
    );
    for (const url of candidates) {
      if (await this.isUsed(url)) continue;
      await this.ds.getRepository(Media).delete({ url });
      await this.s3.deleteByUrl(url);
    }
  }

  async list(params: {
    q?: string;
    page: number;
    perPage: number;
  }): Promise<{ items: AdminMedia[]; total: number }> {
    const where: FindOptionsWhere<Media>[] | undefined = params.q
      ? [{ fileName: ILike(`%${params.q}%`) }, { url: ILike(`%${params.q}%`) }]
      : undefined;
    const [rows, total] = await this.ds.getRepository(Media).findAndCount({
      where,
      relations: { uploadedBy: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
    });
    const items = await Promise.all(rows.map((row) => this.toView(row)));
    return { items, total };
  }

  async get(id: string): Promise<AdminMedia> {
    return this.toView(await this.findOrFail(id));
  }

  /** Deletes a library image; 409 MEDIA_IN_USE (with where) while anything still uses it. */
  async remove(id: string): Promise<void> {
    const media = await this.findOrFail(id);
    const usages = await this.usages(media.url);
    if (usages.length > 0) {
      throw new HttpError(
        409,
        'MEDIA_IN_USE',
        `Used by ${usages.map((usage) => usage.label).join(', ')}; replace it there first`,
        { usages },
      );
    }
    await this.ds.getRepository(Media).delete({ id: media.id });
    await this.s3.deleteByUrl(media.url);
  }

  /**
   * Registers images content already uses but the library doesn't know yet (content from
   * before the library, or uploads that bypassed it). Idempotent; returns how many it added.
   */
  async importExisting(): Promise<number> {
    const [translations, users, pages] = await Promise.all([
      this.ds
        .getRepository(PostTranslation)
        .find({ select: { postId: true, locale: true, imageUrl: true, ogImageUrl: true } }),
      this.ds.getRepository(User).find({ select: { id: true, profileImageUrl: true } }),
      this.ds.getRepository(Page).find({ select: { id: true, draft: true } }),
    ]);
    const referenced = new Set<string>([
      ...translations.flatMap((version) => [version.imageUrl, version.ogImageUrl]).filter(isString),
      ...users.map((user) => user.profileImageUrl).filter(isString),
      ...pages.flatMap((page) => urlsIn(page.draft)),
    ]);
    const ours = [...referenced].filter((url) => Boolean(this.s3.keyFromUrl(url)));
    if (ours.length === 0) return 0;
    const known = new Set(
      (
        await this.ds.getRepository(Media).find({ where: { url: In(ours) }, select: { url: true } })
      ).map((row) => row.url),
    );
    let added = 0;
    for (const url of ours.filter((candidate) => !known.has(candidate))) {
      const head = await this.s3.headByUrl(url);
      if (!head) continue; // The file is gone: nothing to offer in the library
      await this.ds
        .createQueryBuilder()
        .insert()
        .into(Media)
        .values({ url, mimeType: head.contentType, size: head.size, fileName: null })
        .orIgnore()
        .execute();
      added += 1;
    }
    return added;
  }

  /** Keys of pages whose content (any field) holds the URL. */
  private async pagesUsing(url: string): Promise<string[]> {
    const rows = await this.ds
      .getRepository(Page)
      .createQueryBuilder('page')
      .select('page.key', 'key')
      .where('page.draft::text LIKE :pattern', {
        pattern: `%${escapeLike(JSON.stringify(url).slice(1, -1))}%`,
      })
      .getRawMany<{ key: string }>();
    return rows.map((row) => row.key);
  }

  private async findOrFail(id: string): Promise<Media> {
    const media = await this.ds
      .getRepository(Media)
      .findOne({ where: { id }, relations: { uploadedBy: true } });
    if (!media) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Image not found');
    return media;
  }

  private async toView(row: Media): Promise<AdminMedia> {
    return {
      id: row.id,
      url: row.url,
      fileName: row.fileName,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt.toISOString(),
      uploadedBy: toEditor(row.uploadedBy),
      usages: await this.usages(row.url),
    };
  }
}

/** Escapes LIKE wildcards so a URL matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Every http(s) URL string anywhere inside a JSON value (page content). */
export function urlsIn(value: unknown): string[] {
  if (typeof value === 'string') return /^https?:\/\/\S+$/.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(urlsIn);
  if (value && typeof value === 'object') return Object.values(value).flatMap(urlsIn);
  return [];
}
