import {
    Controller,
    Get,
    Post,
    Query,
    Body,
    Res,
    HttpCode,
    BadRequestException,
    UseGuards,
    Request,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import { OAuthService } from './oauth.service.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { filterScopes } from './scopes.js';

interface AuthorizeQuery {
    client_id?: string;
    redirect_uri: string;
    response_type: string;
    scope?: string;
    state?: string;
    code_challenge: string;
    code_challenge_method?: string;
}

interface TokenBody {
    grant_type: string;
    code?: string;
    redirect_uri?: string;
    code_verifier?: string;
    refresh_token?: string;
}

@ApiTags('OAuth 2.0')
@Controller('oauth')
export class OAuthController {
    constructor(
        private readonly oauth: OAuthService,
        private readonly config: ConfigService,
    ) {}

    /**
     * Authorization endpoint — shows login form or issues auth code.
     * GET: renders login HTML. POST: validates credentials, redirects with code.
     */
    @ApiExcludeEndpoint()
    @Get('authorize')
    authorizeGet(@Query() query: AuthorizeQuery, @Res() res: FastifyReply): void {
        if (query.response_type !== 'code') {
            throw new BadRequestException('Only response_type=code is supported');
        }

        if (!query.code_challenge) {
            throw new BadRequestException('PKCE code_challenge is required');
        }

        const webUrl = this.config.get<string>('WEB_URL') ?? 'http://localhost:5173';

        const consentParams = new URLSearchParams({
            response_type: query.response_type,
            redirect_uri: query.redirect_uri,
            code_challenge: query.code_challenge,
            code_challenge_method: query.code_challenge_method ?? 'S256',
            scope: query.scope ?? 'openid',
            state: query.state ?? '',
        });

        res.redirect(`${webUrl}/oauth/consent?${consentParams.toString()}`, 302);
    }

    /**
     * Authorization endpoint (form POST) — validates credentials and redirects with code.
     */
    @ApiExcludeEndpoint()
    @Post('authorize')
    @HttpCode(302)
    async authorizePost(
        @Query() query: AuthorizeQuery,
        @Body() body: { email: string; password: string; selected_scopes?: string },
        @Res() res: FastifyReply,
    ): Promise<void> {
        const { id } = await this.oauth.validatePassword({ email: body.email, password: body.password });

        const requestedScopes = (query.scope ?? 'openid').split(/\s+/);
        const selectedScopes = body.selected_scopes
            ? body.selected_scopes.split(/\s+/)
            : requestedScopes;
        const scopes = filterScopes(selectedScopes.filter((s) => requestedScopes.includes(s)));
        const code = await this.oauth.createAuthCode({
            userId: id,
            redirectUri: query.redirect_uri,
            codeChallenge: query.code_challenge,
            scopes,
        });

        const redirectUrl = new URL(query.redirect_uri);
        redirectUrl.searchParams.set('code', code);

        if (query.state) redirectUrl.searchParams.set('state', query.state);

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
    async token(@Body() body: TokenBody): Promise<object> {
        if (body.grant_type === 'refresh_token') {
            if (!body.refresh_token) throw new BadRequestException('refresh_token is required');

            return this.oauth.refreshAccessToken({ refreshToken: body.refresh_token });
        }

        if (body.grant_type !== 'authorization_code') {
            throw new BadRequestException('Only grant_type=authorization_code or refresh_token is supported');
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
    @UseGuards(CombinedAuthGuard)
    async userinfo(@Request() req: { user: JwtPayload }): Promise<object> {
        return { sub: req.user.sub, email: req.user.email };
    }
}
