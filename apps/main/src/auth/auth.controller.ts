import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Request, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError, ValidationError } from '@ctm/errors';
import { AuthService, type TokenPair } from './auth.service.js';
import type { TokenPair as TokenPairDto, AuthorizedAppDto } from '@ctm/api-client';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { AuthorizedAppsService } from './authorized-apps.service.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';
import { buildRefreshCookieOptions, isWebClient, REFRESH_COOKIE_NAME } from './auth-cookie.js';
import { StrictRateLimit } from '../rate-limit/strict-rate-limit.decorator.js';

interface AuthRequest {
    user: UserDocument;
}

interface JwtRequest {
    user: JwtPayload;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly auth: AuthService,
        private readonly authorizedApps: AuthorizedAppsService,
        private readonly config: ConfigService,
    ) {}

    /**
     * For web clients, move the refresh token into an HttpOnly cookie and strip it
     * from the response body. Bearer clients get the pair unchanged.
     */
    private applyRefreshTransport({
        tokens,
        request,
        reply,
    }: {
        tokens: TokenPair;
        request: FastifyRequest;
        reply: FastifyReply;
    }): TokenPairDto {
        if (!isWebClient({ headers: request.headers })) return tokens;

        reply.setCookie(
            REFRESH_COOKIE_NAME,
            tokens.refreshToken,
            buildRefreshCookieOptions({
                path: this.config.getOrThrow<string>('COOKIE_PATH'),
                secure: this.config.getOrThrow<boolean>('COOKIE_SECURE'),
                maxAgeDays: this.config.getOrThrow<number>('REFRESH_TOKEN_EXPIRES_DAYS'),
            }),
        );

        const { refreshToken: _omitted, ...rest } = tokens;

        return rest;
    }

    /** Register a new account. Returns token pair + user. */
    @ApiOperation({ summary: 'Register a new account' })
    @ApiResponse({ status: 201, description: 'Token pair + user info' })
    @Post('register')
    @StrictRateLimit()
    async register(
        @Body() dto: RegisterDto,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply,
    ): Promise<TokenPairDto> {
        const tokens = await this.auth.register({ email: dto.email, password: dto.password, name: dto.name });

        return this.applyRefreshTransport({ tokens, request, reply });
    }

    /** Login with email + password. Returns token pair + user. */
    @ApiOperation({ summary: 'Login with email + password' })
    @ApiResponse({ status: 200, description: 'Token pair + user info' })
    @Post('login')
    @HttpCode(200)
    @StrictRateLimit()
    @UseGuards(AuthGuard('local'))
    async login(
        @Request() req: AuthRequest,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply,
    ): Promise<TokenPairDto> {
        const tokens = await this.auth.issueTokens(req.user);

        return this.applyRefreshTransport({ tokens, request, reply });
    }

    /** Exchange a refresh token for a new token pair. */
    @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
    @ApiResponse({ status: 200, description: 'New token pair + user info' })
    @Post('refresh')
    @HttpCode(200)
    @StrictRateLimit()
    async refresh(
        @Body() dto: RefreshDto,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply,
    ): Promise<TokenPairDto> {
        const token = request.cookies[REFRESH_COOKIE_NAME] ?? dto.refreshToken;

        if (!token) {
            if (isWebClient({ headers: request.headers })) {
                throw new UnauthorizedError('No refresh token provided');
            }

            throw new ValidationError('refreshToken should not be empty');
        }

        const tokens = await this.auth.refreshTokens(token);

        return this.applyRefreshTransport({ tokens, request, reply });
    }

    /** Revoke the current refresh token and clear the web cookie. */
    @ApiOperation({ summary: 'Log out — revoke the current refresh token' })
    @ApiResponse({ status: 204 })
    @Post('logout')
    @HttpCode(204)
    async logout(
        @Body() dto: RefreshDto,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply,
    ): Promise<void> {
        const token = request.cookies[REFRESH_COOKIE_NAME] ?? dto.refreshToken;

        if (token) {
            await this.auth.revokeRefreshToken({ rawRefreshToken: token });
        }

        if (isWebClient({ headers: request.headers })) {
            reply.clearCookie(REFRESH_COOKIE_NAME, {
                path: this.config.getOrThrow<string>('COOKIE_PATH'),
            });
        }
    }

    /** List OAuth clients the current user has authorized. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'List authorized OAuth apps for the current user' })
    @Get('me/authorized-apps')
    @UseGuards(JwtAuthGuard)
    async listAuthorizedApps(@Request() req: JwtRequest): Promise<AuthorizedAppDto[]> {
        return this.authorizedApps.getAuthorizedApps(req.user.sub);
    }

    /** Revoke access for an authorized OAuth app. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Revoke an authorized OAuth app' })
    @ApiResponse({ status: 204 })
    @Delete('me/authorized-apps/:clientId')
    @HttpCode(204)
    @UseGuards(JwtAuthGuard)
    async revokeAuthorizedApp(@Request() req: JwtRequest, @Param('clientId') clientId: string): Promise<void> {
        await this.authorizedApps.revokeAuthorizedApp({ userId: req.user.sub, clientId });
    }
}
