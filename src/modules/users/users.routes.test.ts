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

const { profileServiceMock } = vi.hoisted(() => ({
  profileServiceMock: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('./services/profile.service', () => ({
  ProfileService: vi.fn(),
  profileService: profileServiceMock,
}));

import app from '../../app';
import { signAccessToken } from '../auth/services/token.service';
import { UPLOAD_DIR } from './shared/upload';

const sampleProfile = {
  id: '11111111-1111-1111-1111-111111111111',
  firstName: 'Vlad',
  lastName: 'T',
  email: 'vlad@example.com',
  profileImageUrl: null,
  emailVerified: true,
  createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
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

describe('GET /profile', () => {
  it('returns 401 without an access cookie', async () => {
    const res = await request(app).get('/profile');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 200 with the profile when authenticated', async () => {
    profileServiceMock.get.mockResolvedValue(sampleProfile);
    const token = signAccessToken(sampleProfile.id);
    const res = await request(app).get('/profile').set('Cookie', [`access=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(sampleProfile.id);
    expect(profileServiceMock.get).toHaveBeenCalledWith(sampleProfile.id);
  });
});

describe('PATCH /profile', () => {
  it('returns 401 without an access cookie', async () => {
    const res = await request(app).patch('/profile').send({ firstName: 'New' });
    expect(res.status).toBe(401);
  });

  it('updates firstName + lastName', async () => {
    profileServiceMock.update.mockResolvedValue({ ...sampleProfile, firstName: 'Vladyslav' });
    const token = signAccessToken(sampleProfile.id);
    const res = await request(app)
      .patch('/profile')
      .set('Cookie', [`access=${token}`])
      .send({ firstName: 'Vladyslav', lastName: 'Tsyvinda' });
    expect(res.status).toBe(200);
    expect(profileServiceMock.update).toHaveBeenCalledWith(sampleProfile.id, {
      firstName: 'Vladyslav',
      lastName: 'Tsyvinda',
      profileImageUrl: undefined,
    });
  });

  it('rejects empty body with 400', async () => {
    const token = signAccessToken(sampleProfile.id);
    const res = await request(app).patch('/profile').set('Cookie', [`access=${token}`]).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(profileServiceMock.update).not.toHaveBeenCalled();
  });

  it('accepts a png image upload and returns updated profile with URL', async () => {
    profileServiceMock.update.mockImplementation(async (_id: string, patch) => ({
      ...sampleProfile,
      profileImageUrl: patch.profileImageUrl ?? null,
    }));
    const token = signAccessToken(sampleProfile.id);

    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);

    const res = await request(app)
      .patch('/profile')
      .set('Cookie', [`access=${token}`])
      .attach('image', pngHeader, { filename: 'avatar.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.profileImageUrl).toMatch(/\/uploads\/profile\/[0-9a-f-]+\.png$/);
    expect(profileServiceMock.update).toHaveBeenCalledTimes(1);
    const call = profileServiceMock.update.mock.calls[0];
    expect(call).toBeDefined();
    expect((call![1] as { profileImageUrl?: string }).profileImageUrl).toMatch(/\.png$/);
  });

  it('rejects an unsupported mime type', async () => {
    const token = signAccessToken(sampleProfile.id);
    const res = await request(app)
      .patch('/profile')
      .set('Cookie', [`access=${token}`])
      .attach('image', Buffer.from('GIF89a'), { filename: 'x.gif', contentType: 'image/gif' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
    expect(profileServiceMock.update).not.toHaveBeenCalled();
  });
});
