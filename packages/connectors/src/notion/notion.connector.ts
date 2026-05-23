import type { OAuthTokens } from '../types.js';
import { NotionOAuthConnector, type NotionOAuthConnectorConfig } from './notion.oauth.js';
import { NotionTaskSource } from './notion.source.js';

/**
 * Combined connector that implements both OAuth and task source for Notion.
 * Delegates OAuth flows to {@link NotionOAuthConnector} and task operations to {@link NotionTaskSource}.
 */
export class NotionConnector extends NotionTaskSource {
    private readonly oauth: NotionOAuthConnector;

    constructor(config: NotionOAuthConnectorConfig) {
        super({ logger: config.logger });
        this.oauth = new NotionOAuthConnector(config);
    }

    /** Build the OAuth authorization URL for the given user state. */
    getAuthUrl(userId: string): string {
        return this.oauth.getAuthUrl(userId);
    }

    /** Exchange an authorization code for OAuth tokens. */
    async exchangeCode(code: string): Promise<OAuthTokens> {
        return this.oauth.exchangeCode(code);
    }

    /** Refresh an expired access token. */
    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        return this.oauth.refreshToken(tokens);
    }

    /** List all Notion databases shared with this integration. */
    async listDatabases(tokens: OAuthTokens): Promise<{ id: string; name: string }[]> {
        return super.listDatabases(tokens);
    }
}
