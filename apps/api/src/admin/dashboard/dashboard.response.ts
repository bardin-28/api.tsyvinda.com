import { ApiProperty } from '@nestjs/swagger';
import type {
  DashboardPostStats,
  DashboardRecentUser,
  DashboardStats,
  DashboardUserStats,
} from '@tsyvinda/shared-types';

class DashboardUserStatsDto implements DashboardUserStats {
  @ApiProperty()
  total: number;

  @ApiProperty()
  admins: number;

  @ApiProperty({ description: 'Email verified, waiting for admin approval' })
  pendingApproval: number;

  @ApiProperty()
  unverified: number;

  @ApiProperty()
  newLast7Days: number;

  @ApiProperty()
  newLast30Days: number;
}

class DashboardPostStatsDto implements DashboardPostStats {
  @ApiProperty()
  total: number;

  @ApiProperty()
  newLast7Days: number;

  @ApiProperty()
  newLast30Days: number;
}

class DashboardRecentUserDto implements DashboardRecentUser {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty()
  approvedByAdmin: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class DashboardStatsDto implements DashboardStats {
  @ApiProperty({ type: DashboardUserStatsDto })
  users: DashboardUserStatsDto;

  @ApiProperty({ type: DashboardPostStatsDto })
  posts: DashboardPostStatsDto;

  @ApiProperty({ type: [DashboardRecentUserDto] })
  recentUsers: DashboardRecentUserDto[];
}
