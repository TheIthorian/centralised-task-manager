import type { ApiHttpClient } from '../../http/api-http-client.js';
import type { DomainClientOptions } from '../../http/http.types.js';
import type { AppConfigDto } from './app-config.types.js';

/** Public, unauthenticated service configuration. */
export class AppConfigClient {
    private readonly http: ApiHttpClient;

    constructor({ http }: DomainClientOptions) {
        this.http = http;
    }

    /** Fetch public client configuration, such as the advertised MCP server URL. */
    async getAppConfig(): Promise<AppConfigDto> {
        return this.http.request<AppConfigDto>({ method: 'GET', path: '/config' });
    }
}
