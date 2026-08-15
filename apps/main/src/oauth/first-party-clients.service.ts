import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { appLogger } from '../logging/app-logger.js';
import { OAuthClientService } from '../auth/oauth-client.service.js';
import { FIRST_PARTY_CLIENTS } from './first-party-clients.js';

/** Registers the clients this project ships, before any of them can reach `/oauth/authorize`. */
@Injectable()
export class FirstPartyClientsService implements OnApplicationBootstrap {
    private readonly logger = appLogger(FirstPartyClientsService.name);

    constructor(private readonly clients: OAuthClientService) {}

    /** Upsert every first-party client definition. */
    async onApplicationBootstrap(): Promise<void> {
        await this.clients.ensureFirstPartyClients(FIRST_PARTY_CLIENTS);

        this.logger.info(
            { clientIds: FIRST_PARTY_CLIENTS.map((client) => client.clientId) },
            'First-party OAuth clients registered',
        );
    }
}
