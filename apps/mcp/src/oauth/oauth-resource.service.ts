import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type OAuthProtectedResourceMetadata = {
    resource: string;
    authorization_servers: string[];
    scopes_supported: string[];
    registration_endpoint?: string;
};

/** Builds RFC 9728 protected resource metadata for MCP OAuth discovery. */
@Injectable()
export class OAuthResourceService {
    constructor(private readonly config: ConfigService) {}

    /** Public base URL of this MCP server (no path). */
    getMcpPublicUrl(): string {
        return this.config.getOrThrow<string>('MCP_PUBLIC_URL').replace(/\/$/, '');
    }

    /** Canonical protected resource identifier for Streamable HTTP MCP. */
    getResource(): string {
        return `${this.getMcpPublicUrl()}/mcp`;
    }

    /** URL of this server's protected resource metadata document. */
    getResourceMetadataUrl(): string {
        return `${this.getMcpPublicUrl()}/.well-known/oauth-protected-resource`;
    }

    /** OAuth authorization server(s) that issue tokens accepted by this MCP server. */
    getAuthorizationServer(): string {
        return this.config.getOrThrow<string>('CTM_API_BASE_URL').replace(/\/$/, '');
    }

    /** URL of the registration endpoint for dynamic client registration (RFC 7591). */
    getRegistrationEndpointUrl(): string {
        return `${this.getAuthorizationServer()}/.well-known/oauth-client`;
    }

    /** RFC 9728 metadata document. */
    getMetadata(): OAuthProtectedResourceMetadata {
        return {
            resource: this.getResource(),
            authorization_servers: [this.getAuthorizationServer()],
            scopes_supported: ['openid', 'email', 'profile'],
            registration_endpoint: this.getRegistrationEndpointUrl(),
        };
    }

    /** `WWW-Authenticate` value for 401 responses per RFC 9728 §5.1. */
    getWwwAuthenticateHeader(): string {
        const metadataUrl = this.getResourceMetadataUrl();
        return `Bearer resource_metadata="${metadataUrl}", scope="openid"`;
    }
}
