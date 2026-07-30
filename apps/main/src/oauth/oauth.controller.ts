import { Controller, Get, Post, Res, HttpCode, BadRequestException, UseGuards, Request, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OAuthClientService, isRedirectUriPermitted } from '../auth/oauth-client.service.js';
import { OAuthService } from './oauth.service.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { filterScopes } from './scopes.js';
import { StrictRateLimit } from '../rate-limit/rate-limit.decorators.js';
import { AuthorizeQueryDto } from './dto/authorize-query.dto.js';
import { ConsentBodyDto, TokenBodyDto } from './dto/token-body.dto.js';
import { ValidatedBody, ValidatedHeader, ValidatedQuery } from '../common/validation/validated.decorators.js';
import { acceptHeaderSchema } from '../common/zod/param-schemas.js';
import type { CodeChallengeMethod } from './pkce.js';

/** Method assumed when the client omits `code_challenge_method`; the server accepts no other. */
const DEFAULT_CODE_CHALLENGE_METHOD: CodeChallengeMethod = 'S256';

@ApiTags('OAuth 2.0')
@Controller('oauth')
export class OAuthController {
    private readonly logger = new Logger(OAuthController.name);

    constructor(
        private readonly oauth: OAuthService,
        private readonly config: ConfigService,
        private readonly oauthClient: OAuthClientService,
    ) {}

    /**
     * Authorization endpoint — shows login form or issues auth code.
     * GET: renders login HTML. POST: validates credentials, redirects with code.
     */
    @ApiExcludeEndpoint()
    @Get('authorize')
    authorizeGet(@ValidatedQuery(AuthorizeQueryDto) query: AuthorizeQueryDto, @Res() res: FastifyReply): void {
        const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:5173');

        const consentParams = new URLSearchParams({
            response_type: query.response_type,
            redirect_uri: query.redirect_uri,
            code_challenge: query.code_challenge,
            code_challenge_method: query.code_challenge_method ?? DEFAULT_CODE_CHALLENGE_METHOD,
            scope: query.scope ?? 'openid',
            state: query.state ?? '',
            ...(query.client_id ? { client_id: query.client_id } : {}),
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
        this.logger.log(
            `authorizePost client_id=${query.client_id ?? 'none'} redirect_uri=${query.redirect_uri} user=${req.user?.sub ?? 'unauthenticated'}`,
        );

        if (query.client_id) {
            const client = await this.oauthClient.findByClientId(query.client_id);

            if (!client) {
                this.logger.warn(`authorizePost unknown client_id=${query.client_id}`);
                throw new BadRequestException('Unrecognised client');
            }

            if (!isRedirectUriPermitted(client.redirectUris, query.redirect_uri)) {
                this.logger.warn(
                    `authorizePost redirect_uri not permitted client_id=${query.client_id} redirect_uri=${query.redirect_uri} registered=${client.redirectUris.join(',')}`,
                );
                throw new BadRequestException('redirect_uri not permitted for this client');
            }
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

        if (query.client_id) await this.oauthClient.markUsed({ clientId: query.client_id });

        const redirectUrl = new URL(query.redirect_uri);
        redirectUrl.searchParams.set('code', code);

        if (query.state) redirectUrl.searchParams.set('state', query.state);

        if (accept.includes('application/json')) {
            await res.status(200).send({ location: redirectUrl.toString() });

            return;
        }

        res.redirect(redirectUrl.toString());
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
