import type { DataSource, Repository } from 'typeorm';
import { config } from '../../config/app.config';
import { AppDataSource } from '../../config/database';
import { HttpError } from '../../shared/http-error';
import { User } from '../users/user.entity';
import { EmailService, emailService } from './email.service';
import { EmailVerification } from './email-verification.entity';
import { hashPassword, verifyPassword } from './password';
import { RefreshToken } from './refresh-token.entity';
import { generateOpaqueToken, hashOpaqueToken, signAccessToken } from './tokens.service';
import { UserIdentity } from './user-identity.entity';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const REUSE_IDEMPOTENCY_MS = 60 * 60 * 1000;

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl: string | null;
  emailVerified: boolean;
  createdAt: Date;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
  userAgent: string | null;
  ip: string | null;
}

export interface RefreshInput {
  rawRefresh: string;
  userAgent: string | null;
  ip: string | null;
}

export interface AuthSessionResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export class AuthService {
  constructor(
    private readonly ds: DataSource = AppDataSource,
    private readonly email: EmailService = emailService,
  ) {}

  private get users(): Repository<User> {
    return this.ds.getRepository(User);
  }

  private get verifications(): Repository<EmailVerification> {
    return this.ds.getRepository(EmailVerification);
  }

  private get refreshTokens(): Repository<RefreshToken> {
    return this.ds.getRepository(RefreshToken);
  }

  async register(input: RegisterInput): Promise<void> {
    const email = input.email;
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'Email already registered');
    }
    const frontend = config.frontendHost[0];
    if (!frontend) {
      throw new HttpError(500, 'EMAIL_NOT_CONFIGURED', 'FRONTEND_HOST is not configured');
    }

    const passwordHash = await hashPassword(input.password);
    const { raw: rawToken, hash: tokenHash } = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    await this.ds.transaction(async (manager) => {
      const user = manager.getRepository(User).create({
        firstName: input.firstName,
        lastName: input.lastName,
        email,
        passwordHash,
        emailVerified: false,
        profileImageUrl: null,
      });
      const savedUser = await manager.getRepository(User).save(user);

      const identity = manager.getRepository(UserIdentity).create({
        userId: savedUser.id,
        provider: 'local',
        providerUserId: savedUser.id,
      });
      await manager.getRepository(UserIdentity).save(identity);

      const verification = manager.getRepository(EmailVerification).create({
        userId: savedUser.id,
        tokenHash,
        expiresAt,
        consumedAt: null,
      });
      await manager.getRepository(EmailVerification).save(verification);
    });

    await this.email.sendVerificationEmail({
      to: email,
      firstName: input.firstName,
      url: `${frontend}/registration?token=${rawToken}`,
    });
  }

  async confirmEmail(rawToken: string): Promise<void> {
    const tokenHash = hashOpaqueToken(rawToken);
    const verification = await this.verifications.findOne({ where: { tokenHash } });
    if (!verification) {
      throw new HttpError(400, 'INVALID_TOKEN', 'Invalid confirmation token');
    }

    const now = Date.now();
    if (verification.consumedAt) {
      const user = await this.users.findOne({ where: { id: verification.userId } });
      if (user?.emailVerified && now - verification.consumedAt.getTime() < REUSE_IDEMPOTENCY_MS) {
        return;
      }
      throw new HttpError(400, 'INVALID_TOKEN', 'Confirmation token already used');
    }
    if (verification.expiresAt.getTime() < now) {
      throw new HttpError(400, 'INVALID_TOKEN', 'Confirmation token expired');
    }

    await this.ds.transaction(async (manager) => {
      verification.consumedAt = new Date();
      await manager.getRepository(EmailVerification).save(verification);
      await manager
        .getRepository(User)
        .update({ id: verification.userId }, { emailVerified: true });
    });
  }

  async login(input: LoginInput): Promise<AuthSessionResult> {
    const user = await this.users.findOne({ where: { email: input.email } });
    if (!user || !user.passwordHash) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    const matches = await verifyPassword(input.password, user.passwordHash);
    if (!matches) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    if (!user.emailVerified) {
      throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Email is not verified');
    }

    return this.issueSession(user, input.userAgent, input.ip);
  }

  async rotateRefresh(input: RefreshInput): Promise<AuthSessionResult> {
    const tokenHash = hashOpaqueToken(input.rawRefresh);
    const existing = await this.refreshTokens.findOne({ where: { tokenHash } });
    if (!existing) {
      throw new HttpError(401, 'INVALID_REFRESH', 'Invalid refresh token');
    }

    if (existing.revokedAt) {
      const userTokens = await this.refreshTokens.find({ where: { userId: existing.userId } });
      const now = new Date();
      const toRevoke = userTokens.filter((token) => !token.revokedAt);
      for (const token of toRevoke) token.revokedAt = now;
      if (toRevoke.length > 0) await this.refreshTokens.save(toRevoke);
      throw new HttpError(401, 'REFRESH_REUSE', 'Refresh token reuse detected');
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new HttpError(401, 'INVALID_REFRESH', 'Refresh token expired');
    }

    const user = await this.users.findOne({ where: { id: existing.userId } });
    if (!user) {
      throw new HttpError(401, 'INVALID_REFRESH', 'Invalid refresh token');
    }

    const session = await this.issueSession(user, input.userAgent, input.ip);
    const newHash = hashOpaqueToken(session.refreshToken);
    const newRow = await this.refreshTokens.findOne({ where: { tokenHash: newHash } });

    existing.revokedAt = new Date();
    existing.replacedById = newRow?.id ?? null;
    await this.refreshTokens.save(existing);

    return session;
  }

  async logout(rawRefresh: string | undefined): Promise<void> {
    if (!rawRefresh) return;
    const tokenHash = hashOpaqueToken(rawRefresh);
    const existing = await this.refreshTokens.findOne({ where: { tokenHash } });
    if (!existing || existing.revokedAt) return;
    existing.revokedAt = new Date();
    await this.refreshTokens.save(existing);
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return toPublicUser(user);
  }

  private async issueSession(
    user: User,
    userAgent: string | null,
    ip: string | null,
  ): Promise<AuthSessionResult> {
    const accessToken = signAccessToken(user.id);
    const { raw: refreshToken, hash: refreshHash } = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + config.auth.refreshTtlDays * 24 * 60 * 60 * 1000);
    const row = this.refreshTokens.create({
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt,
      revokedAt: null,
      replacedById: null,
      userAgent: userAgent?.slice(0, 255) ?? null,
      ip: ip?.slice(0, 45) ?? null,
    });
    await this.refreshTokens.save(row);
    return { accessToken, refreshToken, user: toPublicUser(user) };
  }
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    profileImageUrl: user.profileImageUrl,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

export const authService = new AuthService();
