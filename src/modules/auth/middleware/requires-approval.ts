import { asyncHandler } from '../../../shared/async-handler';
import { AppDataSource } from '../../../db/database';
import { HttpError } from '../../../shared/http-error';
import { User } from '../../users/entities/user.entity';

/**
 * Gate that allows the request through only when the authenticated user has been
 * approved by an admin. Must run after `requireAuth` (relies on `req.user.id`).
 * `approvedByAdmin` is not carried in the access token, so it is read from the DB.
 */
export const requireApproved = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Missing user context');
  }

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: req.user.id },
    select: { id: true, approvedByAdmin: true },
  });

  if (!user) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'User no longer exists');
  }
  if (!user.approvedByAdmin) {
    throw new HttpError(403, 'NOT_APPROVED', 'Account is not approved by an admin');
  }

  next();
});
