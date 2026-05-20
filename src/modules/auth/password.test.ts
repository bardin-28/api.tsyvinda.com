import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password util', () => {
  it('hashes a password and verifies it', async () => {
    const hash = await hashPassword('CorrectHorse42');
    expect(hash).not.toBe('CorrectHorse42');
    expect(hash.length).toBeGreaterThan(20);
    expect(await verifyPassword('CorrectHorse42', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('CorrectHorse42');
    expect(await verifyPassword('WrongHorse42', hash)).toBe(false);
  });

  it('produces a different hash each time (salted)', async () => {
    const a = await hashPassword('Same1234');
    const b = await hashPassword('Same1234');
    expect(a).not.toBe(b);
  });
});
