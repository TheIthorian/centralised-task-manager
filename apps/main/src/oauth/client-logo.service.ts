import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OAuthClient, type OAuthClientDocument } from '@ctm/db';
import { appLogger } from '../logging/app-logger.js';
import { fetchClientLogo, type FetchedLogo } from './client-logo.fetcher.js';

/** Path a stored logo is served from, relative to the API origin. */
export function clientLogoPath(clientId: string): string {
    return `/oauth/clients/${encodeURIComponent(clientId)}/logo`;
}

@Injectable()
export class ClientLogoService {
    private readonly logger = appLogger(ClientLogoService.name);

    constructor(@InjectModel(OAuthClient.name) private readonly model: Model<OAuthClientDocument>) {}

    /**
     * Fetch the logo a client declared and store the re-encoded copy on the client document.
     * Never throws: a logo that cannot be fetched leaves the client without one.
     */
    async storeLogo({ clientId, logoUri }: { clientId: string; logoUri: string }): Promise<void> {
        let logo: FetchedLogo | null = null;

        try {
            logo = await fetchClientLogo({ uri: logoUri });
        } catch (error) {
            this.logger.warn({ clientId, err: error }, 'Failed to fetch client logo');

            return;
        }

        if (!logo) {
            this.logger.warn({ clientId }, 'Client logo rejected');

            return;
        }

        await this.model.updateOne(
            { clientId },
            { $set: { logo: { data: logo.data, contentType: logo.contentType, fetchedAt: new Date() } } },
        );
    }

    /** Return the stored logo for a client, or null if it has none. */
    async getLogo({ clientId }: { clientId: string }): Promise<FetchedLogo | null> {
        const client = await this.model.findOne({ clientId }).select('logo');

        if (!client?.logo) return null;

        return { data: Buffer.from(client.logo.data), contentType: client.logo.contentType };
    }
}
