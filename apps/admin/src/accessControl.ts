import type { Role } from '@tsyvinda/shared-types';

/** Shared by App.tsx (routing) and CustomSidebar.tsx (menu) so both stay in sync. */
export const isVisibleToRole = (roles: Role[], role: Role | undefined): boolean =>
  !!role && roles.includes(role);
