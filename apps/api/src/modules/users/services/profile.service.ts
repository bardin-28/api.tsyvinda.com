import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, type Repository } from 'typeorm';
import { HttpError } from '../../../shared/http-error';
import { S3Service } from '../../../shared/s3/s3.service';
import { toPublicUser, type PublicUser } from '../../auth/services/auth.service';
import { User } from '../entities/user.entity';

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string | null;
}

@Injectable()
export class ProfileService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly s3: S3Service,
  ) {}

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

    if (patch.profileImageUrl !== undefined && prevImage && prevImage !== patch.profileImageUrl) {
      void this.s3.deleteByUrl(prevImage);
    }

    return toPublicUser(user);
  }

  async removeImage(userId: string): Promise<PublicUser> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const prevImage = user.profileImageUrl;
    if (prevImage) {
      user.profileImageUrl = null;
      await this.users.save(user);
      void this.s3.deleteByUrl(prevImage);
    }

    return toPublicUser(user);
  }
}
