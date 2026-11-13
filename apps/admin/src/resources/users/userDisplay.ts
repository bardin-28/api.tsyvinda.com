import { Role, type User } from '@tsyvinda/shared-types';

export const ROLE_CHOICES = [
  { id: Role.USER, name: 'User' },
  { id: Role.ADMIN, name: 'Admin' },
];

export const fullName = (user: Pick<User, 'firstName' | 'lastName'>): string =>
  `${user.firstName} ${user.lastName}`.trim();
