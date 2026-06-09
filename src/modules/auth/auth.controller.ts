import { Body, Controller, HttpCode, Post, Req, Res, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { HttpError } from '../../shared/http-error';
import { ErrorDto } from '../../shared/swagger/error.dto';
import { AuthLoginResponseDto } from './dto/user.response';
import { TurnstileInterceptor } from '../../shared/turnstile/turnstile.interceptor';
import { AuthService } from './services/auth.service';
import {
  clearSessionCookies,
  clientIp,
  clientUserAgent,
  readRefreshCookie,
  setSessionCookies,
} from './shared/auth.utils';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for that email, a password reset link has been sent.';

const MINUTE = 60_000;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @UseInterceptors(TurnstileInterceptor)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Send the Cloudflare Turnstile token as `cf-turnstile-response` when Turnstile is configured.',
  })
  @ApiResponse({ status: 201, description: 'Verification email sent' })
  @ApiResponse({ status: 409, description: 'Email already registered', type: ErrorDto })
  async register(@Body() dto: RegisterDto): Promise<{ message: string }> {
    await this.auth.register({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: dto.password,
    });
    return { message: 'Verification email sent. Please check your inbox.' };
  }

  @Post('confirm-email')
  @HttpCode(200)
  @ApiOperation({ summary: "Confirm a user's email with the token from the verification link" })
  @ApiResponse({ status: 200, description: 'Email confirmed' })
  async confirmEmail(@Body() dto: ConfirmEmailDto): Promise<{ message: string }> {
    await this.auth.confirmEmail(dto.token);
    return { message: 'Email confirmed.' };
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @UseInterceptors(TurnstileInterceptor)
  @ApiOperation({ summary: 'Request a password reset link for an email address' })
  @ApiResponse({ status: 200, description: 'Generic acknowledgement' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.auth.requestPasswordReset(dto.email);
    // Always respond identically to avoid leaking whether the email is registered.
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @UseInterceptors(TurnstileInterceptor)
  @ApiOperation({ summary: 'Set a new password using the token from the reset email' })
  @ApiResponse({ status: 200, description: 'Password updated' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.auth.resetPassword(dto.token, dto.password);
    return { message: 'Password updated. You can now sign in with your new password.' };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @UseInterceptors(TurnstileInterceptor)
  @ApiOperation({
    summary: 'Login with email + password',
    description:
      'Send the Cloudflare Turnstile token as `cf-turnstile-response` when Turnstile is configured.',
  })
  @ApiOkResponse({
    description: 'Authenticated; access + refresh cookies issued',
    type: AuthLoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials', type: ErrorDto })
  @ApiResponse({ status: 403, description: 'Email not verified', type: ErrorDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: unknown }> {
    const session = await this.auth.login({
      email: dto.email,
      password: dto.password,
      userAgent: clientUserAgent(req),
      ip: clientIp(req),
    });
    setSessionCookies(res, session);
    return { user: session.user };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh + access tokens' })
  @ApiOkResponse({
    description: 'New session issued; both cookies rotated',
    type: AuthLoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid refresh', type: ErrorDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: unknown }> {
    const rawRefresh = readRefreshCookie(req);
    if (!rawRefresh) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Missing refresh cookie');
    }
    const session = await this.auth.rotateRefresh({
      rawRefresh,
      userAgent: clientUserAgent(req),
      ip: clientIp(req),
    });
    setSessionCookies(res, session);
    return { user: session.user };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke current refresh token and clear cookie' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readRefreshCookie(req));
    clearSessionCookies(res);
  }
}
