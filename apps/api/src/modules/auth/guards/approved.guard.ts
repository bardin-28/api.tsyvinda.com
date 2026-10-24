import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { HttpError } from '../../../shared/http-error';
import { User } from '../../users/entities/user.entity';

// Replaces the old `requireApproved` middleware. Must run after AuthGuard
// (relies on req.user.id). `approvedByAdmin` is not in the access token, so it is
// read from the DB.
@Injectable()
export class ApprovedGuard implements CanActivate {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.user) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Missing user context');
    }

    const user = await this.users.findOne({
      where: { id: req.user.id },
      select: { id: true, approvedByAdmin: true },
    });

    if (!user) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'User no longer exists');
    }
    if (!user.approvedByAdmin) {
      throw new HttpError(403, 'NOT_APPROVED', 'Account is not approved by an admin');
    }
    return true;
  }
}
