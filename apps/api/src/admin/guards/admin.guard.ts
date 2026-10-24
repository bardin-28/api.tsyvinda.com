import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { Role } from '@tsyvinda/shared-types';
import { HttpError } from '../../shared/http-error';
import { User } from '../../modules/users/entities/user.entity';
import { verifyAccessToken } from '../../modules/auth/services/token.service';
import { readAdminAccessCookie } from '../../modules/auth/shared/auth.utils';

// Admin counterpart of AuthGuard: reads the `admin_access` cookie, accepts only admin-surface
// tokens, and re-reads the role from the DB so a demotion takes effect on the next request.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = readAdminAccessCookie(req);
    if (!token) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Missing admin auth cookie');
    }
    const { sub } = verifyAccessToken(token, 'admin');

    const user = await this.users.findOne({
      where: { id: sub },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'User no longer exists');
    }
    if (user.role !== Role.ADMIN) {
      throw new HttpError(403, 'FORBIDDEN', 'Requires the ADMIN role');
    }

    req.user = { id: user.id };
    return true;
  }
}
