import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthCode, AuthCodeSchema } from './schemas/auth-code.schema.js';
import { AuthorizedClient, AuthorizedClientSchema } from './schemas/authorized-client.schema.js';
import { OAuthClient, OAuthClientSchema } from './schemas/oauth-client.schema.js';
import { OAuthKeyService } from './oauth-key.service.js';
import { FirstPartyClientsService } from './first-party-clients.service.js';
import { OAuthService } from './oauth.service.js';
import { OAuthClientService } from './oauth-client.service.js';
import { AuthorizedClientService } from './authorized-client.service.js';
import { AuthorizedAppsService } from './authorized-apps.service.js';
import { OAuthController } from './oauth.controller.js';
import { WellKnownController } from './well-known.controller.js';
import { TokensModule } from '../tokens/tokens.module.js';
import { UsersModule } from '../users/users.module.js';

/** Owns third-party delegation: clients, consent, authorization codes, PKCE and protocol metadata. */
@Module({
    imports: [
        MongooseModule.forFeature([
            { name: AuthCode.name, schema: AuthCodeSchema },
            { name: OAuthClient.name, schema: OAuthClientSchema },
            { name: AuthorizedClient.name, schema: AuthorizedClientSchema },
        ]),
        TokensModule,
        UsersModule,
    ],
    controllers: [OAuthController, WellKnownController],
    providers: [
        OAuthKeyService,
        OAuthService,
        FirstPartyClientsService,
        OAuthClientService,
        AuthorizedClientService,
        AuthorizedAppsService,
    ],
    exports: [OAuthKeyService, OAuthService, OAuthClientService, AuthorizedAppsService],
})
export class OAuthModule {}
