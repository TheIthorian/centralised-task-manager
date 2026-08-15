import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthCode, AuthCodeSchema } from './schemas/auth-code.schema.js';
import { RefreshToken, RefreshTokenSchema } from '../auth/schemas/refresh-token.schema.js';
import { OAuthKeyService } from './oauth-key.service.js';
import { FirstPartyClientsService } from './first-party-clients.service.js';
import { OAuthService } from './oauth.service.js';
import { OAuthController } from './oauth.controller.js';
import { WellKnownController } from './well-known.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: AuthCode.name, schema: AuthCodeSchema },
            { name: RefreshToken.name, schema: RefreshTokenSchema },
        ]),
        AuthModule,
        UsersModule,
    ],
    controllers: [OAuthController, WellKnownController],
    providers: [OAuthKeyService, OAuthService, FirstPartyClientsService],
    exports: [OAuthKeyService, OAuthService],
})
export class OAuthModule {}
