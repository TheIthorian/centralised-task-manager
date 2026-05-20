import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthKeyService } from './oauth-key.service.js';

@Controller('.well-known')
export class WellKnownController {
    constructor(
        private readonly config: ConfigService,
        private readonly keys: OAuthKeyService,
    ) {}

    private get issuer(): string {
        return this.config.get<string>('REDIRECT_BASE_URL') ?? 'http://localhost:3000';
    }

    /** OpenID Connect Discovery 1.0 metadata. */
    @Get('openid-configuration')
    openidConfiguration(): object {
        const issuer = this.issuer;
        return {
            issuer,
            authorization_endpoint: `${issuer}/oauth/authorize`,
            token_endpoint: `${issuer}/oauth/token`,
            userinfo_endpoint: `${issuer}/oauth/userinfo`,
            jwks_uri: `${issuer}/.well-known/jwks.json`,
            registration_endpoint: undefined,
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
    @Get('oauth-authorization-server')
    authorizationServer(): object {
        const issuer = this.issuer;
        return {
            issuer,
            authorization_endpoint: `${issuer}/oauth/authorize`,
            token_endpoint: `${issuer}/oauth/token`,
            jwks_uri: `${issuer}/.well-known/jwks.json`,
            scopes_supported: ['openid', 'email', 'profile'],
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            token_endpoint_auth_methods_supported: ['none'],
            code_challenge_methods_supported: ['S256'],
        };
    }

    /** JSON Web Key Set — public keys for JWT verification. */
    @Get('jwks.json')
    jwks(): object {
        return this.keys.getJwks();
    }
}
