import bcrypt from 'bcrypt';
import { config } from '../../config/app.config';

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, config.auth.bcryptCost);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
