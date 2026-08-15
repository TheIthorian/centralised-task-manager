import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AccessTokenService } from './access-token.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema.js';

/**
 * Owns the tokens themselves: how they are signed, what they claim, how long they live and how a
 * refresh token is redeemed. `auth` and `oauth` decide who gets one; neither mints its own.
 */
@Module({
    imports: [
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
        MongooseModule.forFeature([{ name: RefreshToken.name, schema: RefreshTokenSchema }]),
    ],
    providers: [AccessTokenService, RefreshTokenService, JwtStrategy],
    exports: [AccessTokenService, RefreshTokenService, JwtModule],
})
export class TokensModule {}
