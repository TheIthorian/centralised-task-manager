import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { OAuthKeyService } from './oauth-key.service.js';

@Controller('.well-known')
export class WellKnownController {
    constructor(
        private readonly config: ConfigService,
        private readonly keys: OAuthKeyService,
    ) {}

    private get issuer(): string {
        return this.config.get<string>('REDIRECT_BASE_URL')!;
    }

    /** RFC 7591 dynamic client registration (implemented in AuthModule). */
    private get registrationEndpoint(): string {
        return `${this.issuer}/.well-known/oauth-client`;
    }

    /** OpenID Connect Discovery 1.0 metadata. */
    @ApiOperation({ summary: 'OpenID Connect configuration' })
    @Get('openid-configuration')
    openidConfiguration(): object {
        const issuer = this.issuer;
        return {
            issuer,
            authorization_endpoint: `${issuer}/oauth/authorize`,
            token_endpoint: `${issuer}/oauth/token`,
            userinfo_endpoint: `${issuer}/oauth/userinfo`,
            jwks_uri: `${issuer}/.well-known/jwks.json`,
            registration_endpoint: this.registrationEndpoint,
            scopes_supported: ['openid', 'email', 'profile'],
            response_types_supported: ['code'],
            response_modes_supported: ['query'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            subject_types_supported: ['public'],
            id_token_signing_alg_values_supported: ['RS256'],
            token_endpoint_auth_methods_supported: ['none'],
            code_challenge_methods_supported: ['S256'],
            claims_supported: ['sub', 'email', 'iss', 'iat', 'exp'],
        };
    }

    /** RFC 8414 OAuth 2.0 Authorization Server Metadata. */
    @ApiOperation({ summary: 'Authorization server metadata' })
    @Get('oauth-authorization-server')
    authorizationServer(): object {
        const issuer = this.issuer;
        return {
            issuer,
            authorization_endpoint: `${issuer}/oauth/authorize`,
            token_endpoint: `${issuer}/oauth/token`,
            registration_endpoint: this.registrationEndpoint,
            jwks_uri: `${issuer}/.well-known/jwks.json`,
            scopes_supported: ['openid', 'email', 'profile'],
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            token_endpoint_auth_methods_supported: ['none'],
            code_challenge_methods_supported: ['S256'],
        };
    }

    /** JSON Web Key Set — public keys for JWT verification. */
    @ApiOperation({ summary: 'JSON Web Key Set' })
    @Get('jwks.json')
    jwks(): object {
        return this.keys.getJwks();
    }
}
