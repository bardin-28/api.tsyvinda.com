import { describe, it, expect } from 'vitest';
import { Role } from '@tsyvinda/shared-types';
import { toUserPayload } from './userPayload';

const file = new File(['x'], 'me.png', { type: 'image/png' });

describe('toUserPayload', () => {
  it('sends only the role when the avatar is unchanged', () => {
    expect(
      toUserPayload(
        { role: Role.ADMIN, profileImageUrl: 'https://cdn.test/profile/a.jpg' },
        { profileImageUrl: 'https://cdn.test/profile/a.jpg' },
      ),
    ).toEqual({ role: Role.ADMIN });
  });

  it('sends a newly picked avatar as image', () => {
    expect(toUserPayload({ role: Role.USER, profileImageUrl: { rawFile: file } })).toEqual({
      role: Role.USER,
      image: { rawFile: file },
    });
  });

  it('asks to remove the avatar when it was cleared', () => {
    expect(
      toUserPayload(
        { role: Role.USER, profileImageUrl: null },
        { profileImageUrl: 'https://cdn.test/profile/a.jpg' },
      ),
    ).toEqual({ role: Role.USER, removeImage: true });
  });

  it('sends nothing extra when there was and is no avatar', () => {
    expect(
      toUserPayload({ role: Role.USER, profileImageUrl: null }, { profileImageUrl: null }),
    ).toEqual({ role: Role.USER });
  });
});
