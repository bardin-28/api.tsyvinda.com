import { existsSync, readdirSync, unlinkSync } from 'fs';
import path from 'path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/database', () => ({
  AppDataSource: {
    isInitialized: true,
    getRepository: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('../../redis/redis', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
    call: vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd === 'SCRIPT') return 'sha';
      return [1, 60];
    }),
    on: vi.fn(),
  },
}));

const { postServiceMock } = vi.hoisted(() => ({
  postServiceMock: {
    create: vi.fn(),
    list: vi.fn(),
    getBySlug: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('./services/post.service', async () => {
  const actual = await vi.importActual<typeof import('./services/post.service')>(
    './services/post.service',
  );
  return {
    ...actual,
    PostService: vi.fn(),
    postService: postServiceMock,
  };
});

import app from '../../app';
import { HttpError } from '../../shared/http-error';
import { signAccessToken } from '../auth/services/token.service';
import { UPLOAD_DIR } from './shared/upload';

const AUTHOR_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';
const POST_ID = '33333333-3333-3333-3333-333333333333';
const POST_SLUG = 'hello-world';

const samplePost = {
  id: POST_ID,
  title: 'Hello',
  slug: POST_SLUG,
  description: 'A post',
  htmlContent: '<p>body</p>',
  imageUrl: null as string | null,
  author: {
    id: AUTHOR_ID,
    firstName: 'Vlad',
    lastName: 'T',
    profileImageUrl: null,
  },
  createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
};

function cleanUploads(): void {
  if (!existsSync(UPLOAD_DIR)) return;
  for (const f of readdirSync(UPLOAD_DIR)) unlinkSync(path.join(UPLOAD_DIR, f));
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanUploads();
});

afterAll(() => {
  cleanUploads();
});

describe('POST /posts', () => {
  it('returns 401 without an access cookie', async () => {
    const res = await request(app)
      .post('/posts')
      .send({ title: 'x', slug: 'x', htmlContent: '<p>y</p>' });
    expect(res.status).toBe(401);
  });

  it('returns 201 when authenticated and body is valid', async () => {
    postServiceMock.create.mockResolvedValue(samplePost);
    const token = signAccessToken(AUTHOR_ID);
    const res = await request(app)
      .post('/posts')
      .set('Cookie', [`access=${token}`])
      .field('title', 'Hello')
      .field('slug', POST_SLUG)
      .field('description', 'A post')
      .field('htmlContent', '<p>body</p>');
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(POST_ID);
    expect(res.body.slug).toBe(POST_SLUG);
    expect(postServiceMock.create).toHaveBeenCalledWith(AUTHOR_ID, {
      title: 'Hello',
      slug: POST_SLUG,
      description: 'A post',
      htmlContent: '<p>body</p>',
      imageUrl: null,
    });
  });

  it('returns 400 when title missing', async () => {
    const token = signAccessToken(AUTHOR_ID);
    const res = await request(app)
      .post('/posts')
      .set('Cookie', [`access=${token}`])
      .field('slug', POST_SLUG)
      .field('htmlContent', '<p>body</p>');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(postServiceMock.create).not.toHaveBeenCalled();
  });

  it('returns 400 when slug missing', async () => {
    const token = signAccessToken(AUTHOR_ID);
    const res = await request(app)
      .post('/posts')
      .set('Cookie', [`access=${token}`])
      .field('title', 'Hello')
      .field('htmlContent', '<p>body</p>');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(postServiceMock.create).not.toHaveBeenCalled();
  });

  it('returns 400 when slug is invalid format', async () => {
    const token = signAccessToken(AUTHOR_ID);
    const res = await request(app)
      .post('/posts')
      .set('Cookie', [`access=${token}`])
      .field('title', 'Hello')
      .field('slug', 'Bad Slug!')
      .field('htmlContent', '<p>body</p>');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(postServiceMock.create).not.toHaveBeenCalled();
  });

  it('returns 409 when slug already taken', async () => {
    postServiceMock.create.mockRejectedValue(
      new HttpError(409, 'SLUG_TAKEN', 'Slug already in use'),
    );
    const token = signAccessToken(AUTHOR_ID);
    const res = await request(app)
      .post('/posts')
      .set('Cookie', [`access=${token}`])
      .field('title', 'Hello')
      .field('slug', POST_SLUG)
      .field('htmlContent', '<p>body</p>');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLUG_TAKEN');
  });
});

describe('GET /posts', () => {
  it('returns items + nextCursor', async () => {
    postServiceMock.list.mockResolvedValue({
      items: [samplePost],
      nextCursor: 'next-cursor-token',
    });
    const res = await request(app).get('/posts').query({ limit: 1 });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.nextCursor).toBe('next-cursor-token');
    expect(postServiceMock.list).toHaveBeenCalledWith({ limit: 1, cursor: undefined });
  });

  it('forwards cursor to the service', async () => {
    postServiceMock.list.mockResolvedValue({ items: [], nextCursor: null });
    const res = await request(app).get('/posts').query({ cursor: 'opaque', limit: 5 });
    expect(res.status).toBe(200);
    expect(postServiceMock.list).toHaveBeenCalledWith({ limit: 5, cursor: 'opaque' });
  });

  it('rejects limit above max', async () => {
    const res = await request(app).get('/posts').query({ limit: 51 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('propagates invalid cursor as 400', async () => {
    postServiceMock.list.mockRejectedValue(
      new HttpError(400, 'INVALID_CURSOR', 'Cursor is not decodable'),
    );
    const res = await request(app).get('/posts').query({ cursor: 'not-base64-json' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CURSOR');
  });
});

describe('GET /posts/:slug', () => {
  it('returns 200 with the post', async () => {
    postServiceMock.getBySlug.mockResolvedValue(samplePost);
    const res = await request(app).get(`/posts/${POST_SLUG}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(POST_ID);
    expect(res.body.slug).toBe(POST_SLUG);
    expect(postServiceMock.getBySlug).toHaveBeenCalledWith(POST_SLUG);
  });

  it('returns 404 when missing', async () => {
    postServiceMock.getBySlug.mockRejectedValue(
      new HttpError(404, 'POST_NOT_FOUND', 'Post not found'),
    );
    const res = await request(app).get(`/posts/${POST_SLUG}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('POST_NOT_FOUND');
  });
});

describe('PATCH /posts/:id', () => {
  it('returns 401 without an access cookie', async () => {
    const res = await request(app).patch(`/posts/${POST_ID}`).send({ title: 'New' });
    expect(res.status).toBe(401);
  });

  it('returns 200 when author updates fields', async () => {
    postServiceMock.update.mockResolvedValue({ ...samplePost, title: 'Updated' });
    const token = signAccessToken(AUTHOR_ID);
    const res = await request(app)
      .patch(`/posts/${POST_ID}`)
      .set('Cookie', [`access=${token}`])
      .field('title', 'Updated');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
    expect(postServiceMock.update).toHaveBeenCalledWith(POST_ID, AUTHOR_ID, {
      title: 'Updated',
      slug: undefined,
      description: undefined,
      htmlContent: undefined,
      imageUrl: undefined,
    });
  });

  it('returns 403 when caller is not the author', async () => {
    postServiceMock.update.mockRejectedValue(
      new HttpError(403, 'FORBIDDEN', 'Only the author can edit this post'),
    );
    const token = signAccessToken(OTHER_USER_ID);
    const res = await request(app)
      .patch(`/posts/${POST_ID}`)
      .set('Cookie', [`access=${token}`])
      .field('title', 'Hacked');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('cleans up uploaded file when validation rejects the body', async () => {
    const token = signAccessToken(AUTHOR_ID);
    const oversized = 'a'.repeat(201);
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const before = readdirSync(UPLOAD_DIR);
    const res = await request(app)
      .patch(`/posts/${POST_ID}`)
      .set('Cookie', [`access=${token}`])
      .field('title', oversized)
      .attach('image', pngHeader, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    await new Promise((r) => setTimeout(r, 50));
    const after = readdirSync(UPLOAD_DIR);
    expect(after.filter((f) => !before.includes(f))).toEqual([]);
    expect(postServiceMock.update).not.toHaveBeenCalled();
  });

  it('rejects empty PATCH with 400', async () => {
    const token = signAccessToken(AUTHOR_ID);
    const res = await request(app).patch(`/posts/${POST_ID}`).set('Cookie', [`access=${token}`]);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(postServiceMock.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /posts/:id', () => {
  it('returns 401 without an access cookie', async () => {
    const res = await request(app).delete(`/posts/${POST_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 204 when author deletes', async () => {
    postServiceMock.remove.mockResolvedValue(undefined);
    const token = signAccessToken(AUTHOR_ID);
    const res = await request(app)
      .delete(`/posts/${POST_ID}`)
      .set('Cookie', [`access=${token}`]);
    expect(res.status).toBe(204);
    expect(postServiceMock.remove).toHaveBeenCalledWith(POST_ID, AUTHOR_ID);
  });

  it('returns 403 when caller is not the author', async () => {
    postServiceMock.remove.mockRejectedValue(
      new HttpError(403, 'FORBIDDEN', 'Only the author can delete this post'),
    );
    const token = signAccessToken(OTHER_USER_ID);
    const res = await request(app)
      .delete(`/posts/${POST_ID}`)
      .set('Cookie', [`access=${token}`]);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when missing', async () => {
    postServiceMock.remove.mockRejectedValue(
      new HttpError(404, 'POST_NOT_FOUND', 'Post not found'),
    );
    const token = signAccessToken(AUTHOR_ID);
    const res = await request(app)
      .delete(`/posts/${POST_ID}`)
      .set('Cookie', [`access=${token}`]);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('POST_NOT_FOUND');
  });
});
