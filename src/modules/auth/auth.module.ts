import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { EmailVerification } from './entities/email-verification.entity';
import { PasswordReset } from './entities/password-reset.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserIdentity } from './entities/user-identity.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { EmailService } from './services/email.service';
import { AuthGuard } from './guards/auth.guard';
import { ApprovedGuard } from './guards/approved.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, EmailVerification, PasswordReset, RefreshToken, UserIdentity]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // EmailService has a primitive constructor param Nest DI can't resolve, so it
    // is built explicitly here.
    { provide: EmailService, useFactory: () => new EmailService() },
    AuthGuard,
    ApprovedGuard,
  ],
  // Guards are consumed by the posts/users modules.
  exports: [AuthGuard, ApprovedGuard],
})
export class AuthModule {}
