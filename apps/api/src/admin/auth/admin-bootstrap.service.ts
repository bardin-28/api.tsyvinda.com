import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { Role } from '@tsyvinda/shared-types';
import { config } from '../../shared/app.config';
import { logger } from '../../shared/logger';
import { User } from '../../modules/users/entities/user.entity';
import { UserIdentity } from '../../modules/auth/entities/user-identity.entity';
import { hashPassword } from '../../modules/auth/services/crypto.service';

// Creates ADMIN_DEFAULT_EMAIL on boot when it doesn't exist, so a fresh environment has a way in.
// Never touches an existing user's password; an existing non-admin with that email is promoted.
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureDefaultAdmin(config.admin.defaultEmail, config.admin.defaultPassword);
  }

  async ensureDefaultAdmin(email?: string, password?: string): Promise<void> {
    if (!email || !password) return;

    const users = this.ds.getRepository(User);
    const existing = await users.findOne({ where: { email } });
    if (existing) {
      if (existing.role !== Role.ADMIN) {
        await users.update({ id: existing.id }, { role: Role.ADMIN });
        logger.info({ userId: existing.id }, 'default admin: promoted existing user to ADMIN');
      }
      return;
    }

    const passwordHash = await hashPassword(password);
    await this.ds.transaction(async (manager) => {
      const user = await manager.getRepository(User).save(
        manager.getRepository(User).create({
          firstName: 'Admin',
          lastName: 'User',
          email,
          passwordHash,
          role: Role.ADMIN,
          emailVerified: true,
          approvedByAdmin: true,
          profileImageUrl: null,
        }),
      );
      await manager.getRepository(UserIdentity).save(
        manager.getRepository(UserIdentity).create({
          userId: user.id,
          provider: 'local',
          providerUserId: user.id,
        }),
      );
      logger.info({ userId: user.id }, 'default admin: created');
    });
  }
}
