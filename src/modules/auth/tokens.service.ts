import { createHash, randomBytes } from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../../config/app.config';
import { HttpError } from '../../shared/http-error';

interface AccessTokenPayload {
  sub: string;
  type: 'access';
}

export function signAccessToken(userId: string): string {
  const payload: AccessTokenPayload = { sub: userId, type: 'access' };
  const options: SignOptions = {
    expiresIn: config.auth.jwtAccessTtl as SignOptions['expiresIn'],
    algorithm: 'HS256',
  };
  return jwt.sign(payload, config.auth.jwtAccessSecret, options);
}

export function verifyAccessToken(token: string): { sub: string } {
  try {
    const decoded = jwt.verify(token, config.auth.jwtAccessSecret, {
      algorithms: ['HS256'],
    }) as AccessTokenPayload;
    if (decoded.type !== 'access' || typeof decoded.sub !== 'string') {
      throw new HttpError(401, 'INVALID_TOKEN', 'Invalid access token');
    }
    return { sub: decoded.sub };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(401, 'INVALID_TOKEN', 'Invalid or expired access token');
  }
}

export function generateOpaqueToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  const hash = hashOpaqueToken(raw);
  return { raw, hash };
}

export function hashOpaqueToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
