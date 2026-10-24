import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { DashboardStats } from '@tsyvinda/shared-types';
import { ErrorDto } from '../../shared/swagger/error.dto';
import { ADMIN_ACCESS_COOKIE_NAME } from '../../modules/auth/shared/auth.utils';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import { AdminDashboardService } from './admin-dashboard.service';
import { DashboardStatsDto } from './dashboard.response';

@ApiTags('Admin dashboard')
@ApiCookieAuth(ADMIN_ACCESS_COOKIE_NAME)
@UseGuards(AdminOriginGuard, AdminGuard)
@Controller('dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Dashboard KPIs: users, posts, latest signups' })
  @ApiOkResponse({ type: DashboardStatsDto })
  @ApiResponse({ status: 401, description: 'Not signed in', type: ErrorDto })
  @ApiResponse({ status: 403, description: 'Not an admin', type: ErrorDto })
  getStats(): Promise<DashboardStats> {
    return this.dashboard.getStats();
  }
}
