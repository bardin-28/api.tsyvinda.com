import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { config } from '../../../shared/app.config';
import { HttpError } from '../../../shared/http-error';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  signAccessToken,
  verifyAccessToken,
} from './token.service';

describe('tokens.service', () => {
  it('signs and verifies an access token (sub matches)', () => {
    const token = signAccessToken('user-abc');
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-abc');
  });

  it('rejects an expired access token with 401 INVALID_TOKEN', () => {
    const expired = jwt.sign({ sub: 'user-abc', type: 'access' }, config.auth.jwtAccessSecret, {
      algorithm: 'HS256',
      expiresIn: '-1s',
    });
    let caught: unknown;
    try {
      verifyAccessToken(expired);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(HttpError);
    expect((caught as HttpError).status).toBe(401);
    expect((caught as HttpError).code).toBe('INVALID_TOKEN');
  });

  it('rejects a token signed with the wrong secret', () => {
    const bogus = jwt.sign({ sub: 'user-abc', type: 'access' }, 'a'.repeat(40), {
      algorithm: 'HS256',
    });
    expect(() => verifyAccessToken(bogus)).toThrowError(/Invalid/);
  });

  it('rejects a token without type=access', () => {
    const wrongType = jwt.sign({ sub: 'user-abc', type: 'refresh' }, config.auth.jwtAccessSecret, {
      algorithm: 'HS256',
    });
    expect(() => verifyAccessToken(wrongType)).toThrowError(/Invalid/);
  });

  it('generates an opaque token with the expected shape', () => {
    const { raw, hash } = generateOpaqueToken();
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(raw.length).toBeGreaterThanOrEqual(40);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOpaqueToken(raw)).toBe(hash);
  });

  it('hashOpaqueToken is deterministic', () => {
    expect(hashOpaqueToken('abc')).toBe(hashOpaqueToken('abc'));
    expect(hashOpaqueToken('abc')).not.toBe(hashOpaqueToken('abd'));
  });
});
