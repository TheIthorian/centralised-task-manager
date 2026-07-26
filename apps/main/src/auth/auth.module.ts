import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { WellKnownController } from './well-known.controller.js';
import { AuthService } from './auth.service.js';
import { LocalStrategy } from './strategies/local.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema.js';
import { OAuthClient, OAuthClientSchema } from './schemas/oauth-client.schema.js';
import { OAuthClientService } from './oauth-client.service.js';
import { AuthorizedAppsService } from './authorized-apps.service.js';

@Module({
    imports: [
        forwardRef(() => UsersModule),
        PassportModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                privateKey: Buffer.from(config.getOrThrow<string>('RSA_PRIVATE_KEY'), 'base64').toString('utf8'),
                publicKey: Buffer.from(config.getOrThrow<string>('RSA_PUBLIC_KEY'), 'base64').toString('utf8'),
                signOptions: {
                    algorithm: 'RS256' as const,
                    expiresIn: config.getOrThrow<number>('JWT_ACCESS_EXPIRES'),
                },
            }),
        }),
        MongooseModule.forFeature([
            { name: RefreshToken.name, schema: RefreshTokenSchema },
            { name: OAuthClient.name, schema: OAuthClientSchema },
        ]),
    ],
    controllers: [AuthController, WellKnownController],
    providers: [AuthService, LocalStrategy, JwtStrategy, OAuthClientService, AuthorizedAppsService],
    exports: [AuthService, JwtModule, OAuthClientService, AuthorizedAppsService],
})
export class AuthModule {}
