import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LocalStrategy } from './strategies/local.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { ApiToken, ApiTokenSchema } from './schemas/api-token.schema.js';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema.js';
import { ApiTokenService } from './api-token.service.js';
import { CombinedAuthGuard } from './guards/combined-auth.guard.js';

@Module({
    imports: [
        forwardRef(() => UsersModule),
        PassportModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                privateKey: Buffer.from(config.getOrThrow<string>('RSA_PRIVATE_KEY'), 'base64').toString('utf8'),
                publicKey: Buffer.from(config.getOrThrow<string>('RSA_PUBLIC_KEY'), 'base64').toString('utf8'),
                signOptions: { algorithm: 'RS256' as const, expiresIn: config.get<string>('JWT_ACCESS_EXPIRES', '15m') },
            }),
        }),
        MongooseModule.forFeature([
            { name: ApiToken.name, schema: ApiTokenSchema },
            { name: RefreshToken.name, schema: RefreshTokenSchema },
        ]),
    ],
    controllers: [AuthController],
    providers: [AuthService, LocalStrategy, JwtStrategy, ApiTokenService, CombinedAuthGuard],
    exports: [AuthService, JwtModule, ApiTokenService, CombinedAuthGuard],
})
export class AuthModule {}
