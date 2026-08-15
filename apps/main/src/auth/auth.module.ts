import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { TokensModule } from '../tokens/tokens.module.js';
import { OAuthModule } from '../oauth/oauth.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LocalStrategy } from './strategies/local.strategy.js';
import { LoginAttempt, LoginAttemptSchema } from '@ctm/db';
import { LoginAttemptsService } from './login-attempts.service.js';

/** Owns the user's own credentials, sessions and login lockout. Third-party delegation is `oauth`. */
@Module({
    imports: [
        UsersModule,
        PassportModule,
        TokensModule,
        // Only for the authorized-apps read model behind GET/DELETE /auth/me/authorized-apps: that
        // is a user-account surface, but the grants it reads belong to the OAuth server.
        OAuthModule,
        MongooseModule.forFeature([{ name: LoginAttempt.name, schema: LoginAttemptSchema }]),
    ],
    controllers: [AuthController],
    providers: [AuthService, LocalStrategy, LoginAttemptsService],
    exports: [AuthService, TokensModule],
})
export class AuthModule {}
