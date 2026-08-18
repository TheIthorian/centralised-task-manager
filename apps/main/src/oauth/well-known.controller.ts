import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { OAuthKeyService } from './oauth-key.service.js';
import { OAuthClientService } from './oauth-client.service.js';
import { RegisterClientDto } from './dto/register-client.dto.js';
import {
    AuthorizationServerMetadataDto,
    JwksDto,
    OpenIdConfigurationDto,
    RegisterClientResponseDto,
} from './dto/well-known-response.dto.js';
import { StrictRateLimit } from '../rate-limit/rate-limit.decorators.js';
import { ValidatedBody } from '@ctm/nest-common';
import { CODE_CHALLENGE_METHODS } from './pkce.js';

const SCOPES_SUPPORTED = ['openid', 'email', 'profile'];
const GRANT_TYPES_SUPPORTED = ['authorization_code', 'refresh_token'];

@Controller('.well-known')
export class WellKnownController {
    constructor(
        private readonly config: ConfigService,
        private readonly keys: OAuthKeyService,
        private readonly oauthClient: OAuthClientService,
    ) {}

    /**
     * RFC 7591 dynamic client registration endpoint.
     *
     * Retained for clients that predate Client ID Metadata Documents; MCP deprecated dynamic
     * client registration in its 2026-07-28 revision.
     *
     * Public and unauthenticated by design, so it carries the strict rate limit: each call is an
     * unbounded insert. Registered clients are public and hold no credential; the authorization
     * code exchange is protected by PKCE.
     */
    @ApiOperation({ summary: 'Register an OAuth 2.0 client' })
    @ApiResponse({
        status: 201,
        description: 'Client registered as a public client (token_endpoint_auth_method: none)',
        type: RegisterClientResponseDto,
    })
    @Post('oauth-client')
    @HttpCode(201)
    @StrictRateLimit()
    async registerClient(@ValidatedBody(RegisterClientDto) dto: RegisterClientDto): Promise<RegisterClientResponseDto> {
        return this.oauthClient.register(dto);
    }

    /** OpenID Connect Discovery 1.0 metadata. */
    @ApiOperation({ summary: 'OpenID Connect configuration' })
    @Get('openid-configuration')
    openidConfiguration(): OpenIdConfigurationDto {
        const issuer = this.issuer;

        return {
            issuer,
            authorization_endpoint: `${issuer}/oauth/authorize`,
            token_endpoint: `${issuer}/oauth/token`,
            userinfo_endpoint: `${issuer}/oauth/userinfo`,
            jwks_uri: `${issuer}/.well-known/jwks.json`,
            registration_endpoint: this.registrationEndpoint,
            scopes_supported: SCOPES_SUPPORTED,
            response_types_supported: ['code'],
            response_modes_supported: ['query'],
            grant_types_supported: GRANT_TYPES_SUPPORTED,
            subject_types_supported: ['public'],
            id_token_signing_alg_values_supported: ['RS256'],
            token_endpoint_auth_methods_supported: ['none'],
            code_challenge_methods_supported: [...CODE_CHALLENGE_METHODS],
            claims_supported: ['sub', 'email', 'iss', 'iat', 'exp'],
            client_id_metadata_document_supported: true,
            authorization_response_iss_parameter_supported: true,
        };
    }

    /** RFC 8414 OAuth 2.0 Authorization Server Metadata. */
    @ApiOperation({ summary: 'Authorization server metadata' })
    @Get('oauth-authorization-server')
    authorizationServer(): AuthorizationServerMetadataDto {
        const issuer = this.issuer;

        return {
            issuer,
            authorization_endpoint: `${issuer}/oauth/authorize`,
            token_endpoint: `${issuer}/oauth/token`,
            registration_endpoint: this.registrationEndpoint,
            jwks_uri: `${issuer}/.well-known/jwks.json`,
            scopes_supported: SCOPES_SUPPORTED,
            response_types_supported: ['code'],
            grant_types_supported: GRANT_TYPES_SUPPORTED,
            token_endpoint_auth_methods_supported: ['none'],
            code_challenge_methods_supported: [...CODE_CHALLENGE_METHODS],
            client_id_metadata_document_supported: true,
            authorization_response_iss_parameter_supported: true,
        };
    }

    /** JSON Web Key Set — public keys for JWT verification. */
    @ApiOperation({ summary: 'JSON Web Key Set' })
    @Get('jwks.json')
    jwks(): JwksDto {
        return this.keys.getJwks();
    }

    private get issuer(): string {
        return this.config.getOrThrow<string>('REDIRECT_BASE_URL');
    }

    private get registrationEndpoint(): string {
        return `${this.issuer}/.well-known/oauth-client`;
    }
}
