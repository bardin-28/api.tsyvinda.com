export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

/** Public user shape returned by the API (dates are ISO strings on the wire). */
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  profileImageUrl: string | null;
  emailVerified: boolean;
  approvedByAdmin: boolean;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Login / refresh response. Tokens travel only in httpOnly cookies, never in the body. */
export interface AuthSession {
  user: User;
}
