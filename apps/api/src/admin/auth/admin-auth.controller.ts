import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { HttpError } from '../../shared/http-error';
import { ErrorDto } from '../../shared/swagger/error.dto';
import { LoginDto } from '../../modules/auth/dto/login.dto';
import { AuthLoginResponseDto, UserDto } from '../../modules/auth/dto/user.response';
import { CurrentUser, type AuthUser } from '../../modules/auth/decorators/current-user.decorator';
import { AuthService, type PublicUser } from '../../modules/auth/services/auth.service';
import {
  ADMIN_ACCESS_COOKIE_NAME,
  clearAdminSessionCookies,
  clientIp,
  clientUserAgent,
  readAdminRefreshCookie,
  setAdminSessionCookies,
} from '../../modules/auth/shared/auth.utils';
import { AdminGuard } from '../guards/admin.guard';
import { AdminOriginGuard } from '../guards/admin-origin.guard';

const MINUTE = 60_000;

// Admin panel session. Tokens travel only in the httpOnly admin_* cookies, never in a body.
// No Turnstile: the panel has no widget, so login gets a tighter throttle instead.
@ApiTags('Admin auth')
@UseGuards(AdminOriginGuard)
@Controller('auth')
export class AdminAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @ApiOperation({ summary: 'Admin login with email + password' })
  @ApiOkResponse({ description: 'Admin cookies issued', type: AuthLoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials or not an admin', type: ErrorDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    const session = await this.auth.login({
      email: dto.email,
      password: dto.password,
      userAgent: clientUserAgent(req),
      ip: clientIp(req),
      surface: 'admin',
    });
    setAdminSessionCookies(res, session);
    return { user: session.user };
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  @ApiOperation({ summary: 'Rotate the admin refresh + access tokens' })
  @ApiOkResponse({ description: 'Both admin cookies rotated', type: AuthLoginResponseDto })
  @ApiResponse({ status: 401, description: 'Missing/invalid refresh', type: ErrorDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    const rawRefresh = readAdminRefreshCookie(req);
    if (!rawRefresh) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Missing admin refresh cookie');
    }
    const session = await this.auth.rotateRefresh({
      rawRefresh,
      userAgent: clientUserAgent(req),
      ip: clientIp(req),
      surface: 'admin',
    });
    setAdminSessionCookies(res, session);
    return { user: session.user };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the admin session and clear its cookies' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readAdminRefreshCookie(req));
    clearAdminSessionCookies(res);
  }

  @Get('me')
  @UseGuards(AdminGuard)
  @ApiCookieAuth(ADMIN_ACCESS_COOKIE_NAME)
  @ApiOperation({ summary: 'Current admin user' })
  @ApiOkResponse({ type: UserDto })
  @ApiResponse({ status: 401, description: 'Not signed in', type: ErrorDto })
  @ApiResponse({ status: 403, description: 'Not an admin', type: ErrorDto })
  me(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.auth.getPublicUser(user.id);
  }
}
