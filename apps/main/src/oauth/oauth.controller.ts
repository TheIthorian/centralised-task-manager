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
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import { OAuthService } from './oauth.service.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

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
}

@ApiTags('OAuth 2.0')
@Controller('oauth')
export class OAuthController {
    constructor(private readonly oauth: OAuthService) {}

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

        const params = new URLSearchParams({
            redirect_uri: query.redirect_uri,
            code_challenge: query.code_challenge,
            scope: query.scope ?? 'openid',
            state: query.state ?? '',
        });

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in — CTM</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 80px auto; padding: 0 16px; }
    h1 { font-size: 1.4rem; margin-bottom: 1.5rem; }
    label { display: block; margin-bottom: 4px; font-size: 0.875rem; font-weight: 500; }
    input { width: 100%; padding: 8px 10px; margin-bottom: 16px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box; }
    button { width: 100%; padding: 10px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    .error { color: #dc2626; font-size: 0.875rem; margin-bottom: 12px; }
  </style>
</head>
<body>
  <h1>Sign in to CTM</h1>
  <form method="POST" action="/oauth/authorize?${params.toString()}">
    <label for="email">Email</label>
    <input id="email" type="email" name="email" required autocomplete="email">
    <label for="password">Password</label>
    <input id="password" type="password" name="password" required autocomplete="current-password">
    <button type="submit">Sign in</button>
  </form>
</body>
</html>`;

        res.type('text/html').send(html);
    }

    /**
     * Authorization endpoint (form POST) — validates credentials and redirects with code.
     */
    @ApiExcludeEndpoint()
    @Post('authorize')
    @HttpCode(302)
    async authorizePost(
        @Query() query: AuthorizeQuery,
        @Body() body: { email: string; password: string },
        @Res() res: FastifyReply,
    ): Promise<void> {
        const { id } = await this.oauth.validatePassword({ email: body.email, password: body.password });

        const scopes = (query.scope ?? 'openid').split(' ');
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
    @ApiOperation({ summary: 'Exchange authorization code for tokens', description: 'Supports `grant_type=authorization_code` with PKCE (`code_verifier`).' })
    @Post('token')
    @HttpCode(200)
    async token(@Body() body: TokenBody): Promise<object> {
        if (body.grant_type !== 'authorization_code') {
            throw new BadRequestException('Only grant_type=authorization_code is supported');
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
        return {
            sub: req.user.sub,
            email: req.user.email,
        };
    }
}
