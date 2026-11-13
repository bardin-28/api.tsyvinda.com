import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ILike, Not, type DataSource, type FindOptionsWhere } from 'typeorm';
import {
  CACHE_TAGS,
  type AdminRedirect,
  type AdminRedirectInput,
  type ListResponse,
} from '@tsyvinda/shared-types';
import { HttpError } from '../../../shared/http-error';
import { Redirect } from '../entities/redirect.entity';
import { RevalidationService } from './revalidation.service';

const notFound = () => new HttpError(404, 'REDIRECT_NOT_FOUND', 'Redirect not found');

function invalid(field: string, message: string): HttpError {
  return new HttpError(400, 'VALIDATION_FAILED', message, { fieldErrors: { [field]: message } });
}

/** "/Old-Page/" → "/old-page": decoded, lowercased, no trailing slash, no query or hash. */
export function normalizeSourcePath(raw: string): string {
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) {
    throw invalid('source', 'Must be a path starting with "/"');
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(value.split(/[?#]/)[0]!);
  } catch {
    throw invalid('source', 'Not a valid path');
  }
  const path = `/${decoded.split('/').filter(Boolean).join('/')}`.toLowerCase();
  if (path === '/') throw invalid('source', 'The home page cannot be redirected');
  if (path.length > 500) throw invalid('source', 'At most 500 characters');
  return path;
}

/** Target: a site path ("/about", "/uk/blog#x") or an absolute http(s) URL. */
export function normalizeTarget(raw: string): string {
  const value = raw.trim();
  if (value.length > 1000) throw invalid('target', 'At most 1000 characters');
  if (/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(value)) return value;
  if (value.startsWith('/') && !value.startsWith('//') && !/\s/.test(value)) return value;
  throw invalid('target', 'Must be a path starting with "/" or an http(s) URL');
}

export interface ListRedirectsInput {
  page: number;
  perPage: number;
  q?: string;
}

/** Redirects an admin sets up for addresses the website no longer has. */
@Injectable()
export class RedirectsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly revalidation: RevalidationService,
  ) {}

  private get repo() {
    return this.ds.getRepository(Redirect);
  }

  async list(input: ListRedirectsInput): Promise<ListResponse<AdminRedirect>> {
    const where: FindOptionsWhere<Redirect>[] | undefined = input.q
      ? [
          { source: ILike(`%${escapeLike(input.q)}%`) },
          { target: ILike(`%${escapeLike(input.q)}%`) },
        ]
      : undefined;
    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (input.page - 1) * input.perPage,
      take: input.perPage,
    });
    return { items: rows.map(toAdmin), total };
  }

  async get(id: string): Promise<AdminRedirect> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw notFound();
    return toAdmin(row);
  }

  async create(input: AdminRedirectInput): Promise<AdminRedirect> {
    const values = await this.validate(input);
    const row = await this.repo.save(this.repo.create(values));
    this.revalidation.revalidate([CACHE_TAGS.routes]);
    return toAdmin(row);
  }

  async update(id: string, input: AdminRedirectInput): Promise<AdminRedirect> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw notFound();
    const values = await this.validate(input, id);
    await this.repo.update({ id }, values);
    this.revalidation.revalidate([CACHE_TAGS.routes]);
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete({ id });
    if (!result.affected) throw notFound();
    this.revalidation.revalidate([CACHE_TAGS.routes]);
  }

  private async validate(input: AdminRedirectInput, id?: string) {
    const source = normalizeSourcePath(input.source);
    const target = normalizeTarget(input.target);
    const targetPath = target.split(/[?#]/)[0]!.replace(/\/+$/, '').toLowerCase() || '/';
    if (targetPath === source) throw invalid('target', 'A redirect cannot point to itself');

    const others = id ? { id: Not(id) } : {};
    if (await this.repo.findOne({ where: { source, ...others } })) {
      throw new HttpError(409, 'REDIRECT_EXISTS', 'This address already redirects', {
        fieldErrors: { source: 'Already redirected' },
      });
    }
    // No chains: the target must not itself redirect, and nothing may point at this source
    if (await this.repo.findOne({ where: { source: targetPath, enabled: true, ...others } })) {
      throw invalid('target', 'This address redirects again; point to its final address');
    }
    if (await this.repo.findOne({ where: { target: source, enabled: true, ...others } })) {
      throw invalid('source', 'Another redirect points here; change that one instead');
    }
    return {
      source,
      target,
      type: input.type,
      enabled: input.enabled,
      note: input.note?.trim() || null,
    };
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function toAdmin(row: Redirect): AdminRedirect {
  return {
    id: row.id,
    source: row.source,
    target: row.target,
    type: row.type,
    enabled: row.enabled,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
