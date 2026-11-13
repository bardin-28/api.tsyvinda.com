export interface DashboardUserStats {
  total: number;
  admins: number;
  unverified: number;
  newLast7Days: number;
  newLast30Days: number;
}

export interface DashboardPostStats {
  total: number;
  newLast7Days: number;
  newLast30Days: number;
}

export interface DashboardRecentUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface DashboardStats {
  users: DashboardUserStats;
  posts: DashboardPostStats;
  recentUsers: DashboardRecentUser[];
}
