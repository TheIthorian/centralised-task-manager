import type { OAuthClientInfoDto as IOAuthClientInfoDto } from '@ctm/api-client';

/** Public metadata for an OAuth client, shown on the consent screen. No secret material. */
export class OAuthClientInfoDto implements IOAuthClientInfoDto {
    clientId!: string;

    /** Self-declared by the client at registration, so unverified for a dynamic client. */
    clientName!: string;

    /** True when the client registered itself through the public registration endpoint. */
    isDynamic!: boolean;

    /** Distinct hosts of the client's registered redirect URIs, in registration order. */
    redirectHosts!: string[];
}
