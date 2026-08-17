import { Controller, Get, Post, Res, HttpCode, BadRequestException, UseGuards, Request } from '@nestjs/common';
import { appLogger } from '../logging/app-logger.js';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiExcludeEndpoint, ApiBearerAuth } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { NotFoundError } from '@ctm/errors';
import { JwtAuthGuard } from '../tokens/jwt-auth.guard.js';
import { OAuthClientService, isRedirectUriPermitted } from './oauth-client.service.js';
import { ClientLogoService } from './client-logo.service.js';
import { OAuthService } from './oauth.service.js';
import type { JwtPayload } from '../tokens/token-claims.js';
import { filterScopes } from './scopes.js';
import { StrictRateLimit } from '../rate-limit/rate-limit.decorators.js';
import { AuthorizeQueryDto } from './dto/authorize-query.dto.js';
import { ConsentBodyDto, TokenBodyDto } from './dto/token-body.dto.js';
import { OAuthClientInfoDto } from './dto/client-info-response.dto.js';
import {
    acceptHeaderSchema,
    ValidatedBody,
    ValidatedHeader,
    ValidatedParam,
    ValidatedQuery,
    ValidatedQueryValue,
} from '@ctm/nest-common';
import type { CodeChallengeMethod } from './pkce.js';
import { clientIdSchema } from './client-id.js';

/** Method assumed when the client omits `code_challenge_method`; the server accepts no other. */
const DEFAULT_CODE_CHALLENGE_METHOD: CodeChallengeMethod = 'S256';

@ApiTags('OAuth 2.0')
@Controller('oauth')
export class OAuthController {
    private readonly logger = appLogger(OAuthController.name);

    constructor(
        private readonly oauth: OAuthService,
        private readonly config: ConfigService,
        private readonly oauthClient: OAuthClientService,
        private readonly clientLogos: ClientLogoService,
    ) {}

    /**
     * Authorization endpoint — shows login form or issues auth code.
     * GET: renders login HTML. POST: validates credentials, redirects with code.
     */
    @ApiExcludeEndpoint()
    @Get('authorize')
    authorizeGet(@ValidatedQuery(AuthorizeQueryDto) query: AuthorizeQueryDto, @Res() res: FastifyReply): void {
        const webUrl = this.config.getOrThrow<string>('WEB_URL');

        const consentParams = new URLSearchParams({
            response_type: query.response_type,
            redirect_uri: query.redirect_uri,
            code_challenge: query.code_challenge,
            code_challenge_method: query.code_challenge_method ?? DEFAULT_CODE_CHALLENGE_METHOD,
            scope: query.scope ?? 'openid',
            state: query.state ?? '',
            client_id: query.client_id,
        });

        res.redirect(`${webUrl}/oauth/consent?${consentParams.toString()}`, 302);
    }

    /**
     * Authorization endpoint (POST) — issues auth code for the authenticated user.
     * Requires a valid Bearer token in the Authorization header.
     */
    @ApiExcludeEndpoint()
    @Post('authorize')
    @HttpCode(302)
    @UseGuards(JwtAuthGuard)
    async authorizePost(
        @ValidatedQuery(AuthorizeQueryDto) query: AuthorizeQueryDto,
        @ValidatedBody(ConsentBodyDto) body: ConsentBodyDto,
        @Request() req: { user: JwtPayload },
        @Res() res: FastifyReply,
        @ValidatedHeader({ name: 'accept', schema: acceptHeaderSchema }) accept: string,
    ): Promise<void> {
        // Routine protocol detail: interesting while debugging a client, noise in an incident.
        this.logger.debug({ clientId: query.client_id ?? null }, 'Authorization request received');

        const client = await this.oauthClient.resolveByClientId(query.client_id);

        if (!client) {
            this.logger.warn({ clientId: query.client_id }, 'Authorization request from unknown client');

            throw new BadRequestException('Unrecognised client');
        }

        if (!isRedirectUriPermitted(client.redirectUris, query.redirect_uri)) {
            this.logger.warn(
                {
                    clientId: query.client_id,
                    redirectUri: query.redirect_uri,
                    registeredRedirectUris: client.redirectUris,
                },
                'Authorization request with an unregistered redirect_uri',
            );

            throw new BadRequestException('redirect_uri not permitted for this client');
        }

        const requestedScopes = (query.scope ?? 'openid').split(/\s+/);
        const selectedScopes = body.selected_scopes ? body.selected_scopes.split(/\s+/) : requestedScopes;
        const scopes = filterScopes(selectedScopes.filter((s) => requestedScopes.includes(s)));
        const code = await this.oauth.createAuthCode({
            userId: req.user.sub,
            redirectUri: query.redirect_uri,
            codeChallenge: query.code_challenge,
            codeChallengeMethod: query.code_challenge_method ?? DEFAULT_CODE_CHALLENGE_METHOD,
            scopes,
            clientId: query.client_id,
        });

        await this.oauthClient.markUsed({ clientId: query.client_id });

        const redirectUrl = new URL(query.redirect_uri);
        redirectUrl.searchParams.set('code', code);
        // RFC 9207: lets the client confirm which authorization server answered before it sends
        // the code to a token endpoint.
        redirectUrl.searchParams.set('iss', this.config.getOrThrow<string>('REDIRECT_BASE_URL'));

        if (query.state) redirectUrl.searchParams.set('state', query.state);

        if (accept.includes('application/json')) {
            await res.status(200).send({ location: redirectUrl.toString() });

            return;
        }

        res.redirect(redirectUrl.toString());
    }

    /**
     * Public metadata for a registered client, so the consent screen can say who is asking and
     * where the user is about to be sent.
     *
     * Behind the JWT guard: consent only renders for a signed-in user, and leaving this open would
     * turn client ids into a public existence oracle.
     */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Get public metadata for an OAuth client' })
    @Get('client-info')
    @UseGuards(JwtAuthGuard)
    async clientInfo(
        @ValidatedQueryValue({ name: 'client_id', schema: clientIdSchema }) clientId: string,
    ): Promise<OAuthClientInfoDto> {
        const info = await this.oauthClient.getPublicClientInfo({ clientId });

        if (!info) throw new NotFoundError(`OAuth client ${clientId}`);

        return info;
    }

    /**
     * Serves the logo a client declared at registration, after this server fetched, validated and
     * re-encoded it.
     *
     * Unauthenticated, unlike `client-info`: it is loaded as an `<img src>`, which cannot carry a
     * bearer token. A client with no usable logo is indistinguishable from an unknown one, so this
     * is not an existence oracle either.
     */
    @ApiExcludeEndpoint()
    @Get('clients/:clientId/logo')
    async clientLogo(
        @ValidatedParam({ name: 'clientId', schema: clientIdSchema }) clientId: string,
        @Res() res: FastifyReply,
    ): Promise<void> {
        const logo = await this.clientLogos.getLogo({ clientId });

        if (!logo) throw new NotFoundError(`Logo for OAuth client ${clientId}`);

        await res
            .header('content-type', logo.contentType)
            .header('cache-control', 'public, max-age=86400')
            .header('x-content-type-options', 'nosniff')
            .header('content-security-policy', "default-src 'none'; sandbox")
            // The web app is served from a different origin to this API.
            .header('cross-origin-resource-policy', 'cross-origin')
            .send(logo.data);
    }

    /**
     * Token endpoint — exchanges authorization code for access_token + id_token.
     * Supports grant_type: authorization_code.
     */
    @ApiOperation({
        summary: 'Exchange authorization code for tokens',
        description: 'Supports `grant_type=authorization_code` with PKCE (`code_verifier`).',
    })
    @Post('token')
    @HttpCode(200)
    @StrictRateLimit()
    async token(@ValidatedBody(TokenBodyDto) body: TokenBodyDto): Promise<object> {
        if (body.grant_type === 'refresh_token') {
            if (!body.refresh_token) throw new BadRequestException('refresh_token is required');

            return this.oauth.refreshAccessToken({ refreshToken: body.refresh_token });
        }

        if (!body.code || !body.redirect_uri || !body.code_verifier) {
            throw new BadRequestException('code, redirect_uri, and code_verifier are required');
        }

        return this.oauth.exchangeCode({
            code: body.code,
            redirectUri: body.redirect_uri,
            codeVerifier: body.code_verifier,
        });
    }

    /**
     * UserInfo endpoint — returns OIDC claims for the authenticated user.
     * Accepts the access_token issued by this server (JWT RS256).
     */
    @ApiOperation({ summary: 'Get OIDC claims for the authenticated user' })
    @Get('userinfo')
    @UseGuards(JwtAuthGuard)
    async userinfo(@Request() req: { user: JwtPayload }): Promise<object> {
        return { sub: req.user.sub, email: req.user.email };
    }
}
