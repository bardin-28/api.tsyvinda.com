import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { HttpError } from '../../shared/http-error';
import { ErrorDto } from '../../shared/swagger/error.dto';
import { LoginDto } from '../../modules/auth/dto/login.dto';
import { AuthLoginResponseDto, UserDto } from '../../modules/auth/dto/user.response';
import { CurrentUser, type AuthUser } from '../../modules/auth/decorators/current-user.decorator';
import {
  AuthService,
  type AuthSessionResult,
  type PublicUser,
} from '../../modules/auth/services/auth.service';
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
import { AdminLoginLockoutService } from './admin-login-lockout.service';

const MINUTE = 60_000;

// Admin panel session. Tokens travel only in the httpOnly admin_* cookies, never in a body.
// No Turnstile: the panel has no widget, so login gets a tighter throttle instead: 5/min per
// IP, then that IP is blocked for 15 min, plus a per-email lockout (AdminLoginLockoutService).
@ApiTags('Admin auth')
@UseGuards(AdminOriginGuard)
@Controller('auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly lockout: AdminLoginLockoutService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: MINUTE, blockDuration: 15 * MINUTE } })
  @ApiOperation({ summary: 'Admin login with email + password' })
  @ApiOkResponse({ description: 'Admin cookies issued', type: AuthLoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials or not an admin', type: ErrorDto })
  @ApiResponse({ status: 429, description: 'Too many attempts (IP or account)', type: ErrorDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    await this.lockout.assertNotLocked(dto.email);
    let session: AuthSessionResult;
    try {
      session = await this.auth.login({
        email: dto.email,
        password: dto.password,
        userAgent: clientUserAgent(req),
        ip: clientIp(req),
        surface: 'admin',
      });
    } catch (err) {
      if (err instanceof HttpError && err.status === 401)
        await this.lockout.recordFailure(dto.email);
      throw err;
    }
    await this.lockout.reset(dto.email);
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
