import { unlink } from 'fs/promises';
import path from 'path';
import type { DataSource, Repository } from 'typeorm';
import { AppDataSource } from '../../../db/database';
import { HttpError } from '../../../shared/http-error';
import { toPublicUser, type PublicUser } from '../../auth/services/auth.service';
import { User } from '../entities/user.entity';
import { UPLOAD_DIR } from '../shared/upload';

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

export class ProfileService {
  constructor(private readonly ds: DataSource = AppDataSource) {}

  private get users(): Repository<User> {
    return this.ds.getRepository(User);
  }

  async get(userId: string): Promise<PublicUser> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return toPublicUser(user);
  }

  async update(userId: string, patch: UpdateProfileInput): Promise<PublicUser> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const prevImage = user.profileImageUrl;

    if (patch.firstName !== undefined) user.firstName = patch.firstName;
    if (patch.lastName !== undefined) user.lastName = patch.lastName;
    if (patch.profileImageUrl !== undefined) user.profileImageUrl = patch.profileImageUrl;

    await this.users.save(user);

    if (patch.profileImageUrl && prevImage && prevImage !== patch.profileImageUrl) {
      void deletePriorImage(prevImage);
    }

    return toPublicUser(user);
  }
}

async function deletePriorImage(prevUrl: string): Promise<void> {
  const filename = path.basename(prevUrl);
  if (!filename || filename.includes('/') || filename.includes('\\')) return;
  try {
    await unlink(path.join(UPLOAD_DIR, filename));
  } catch {
    // best-effort cleanup
  }
}

export const profileService = new ProfileService();
