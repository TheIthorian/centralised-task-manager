import { Body, Controller, Delete, Get, HttpCode, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService, type TokenPair } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { CreateTokenDto } from './dto/create-token.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CombinedAuthGuard } from './guards/combined-auth.guard.js';
import { ApiTokenService } from './api-token.service.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

interface AuthRequest {
    user: UserDocument;
}

interface JwtRequest {
    user: JwtPayload;
}

type TokenResponse = TokenPair & { user: { id: string; email: string } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly auth: AuthService,
        private readonly apiTokens: ApiTokenService,
    ) {}

    /** Register a new account. Returns token pair + user. */
    @ApiOperation({ summary: 'Register a new account' })
    @ApiResponse({ status: 201, description: 'Token pair + user info' })
    @Post('register')
    async register(@Body() dto: RegisterDto): Promise<TokenResponse> {
        return this.auth.register({ email: dto.email, password: dto.password, name: dto.name });
    }

    /** Login with email + password. Returns token pair + user. */
    @ApiOperation({ summary: 'Login with email + password' })
    @ApiResponse({ status: 200, description: 'Token pair + user info' })
    @Post('login')
    @HttpCode(200)
    @UseGuards(AuthGuard('local'))
    async login(@Request() req: AuthRequest): Promise<TokenResponse> {
        return this.auth.issueTokens(req.user);
    }

    /** Exchange a refresh token for a new token pair. */
    @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
    @ApiResponse({ status: 200, description: 'New token pair + user info' })
    @Post('refresh')
    @HttpCode(200)
    async refresh(@Body() dto: RefreshDto): Promise<TokenResponse> {
        return this.auth.refreshTokens(dto.refreshToken);
    }

    /** Issue a new long-lived API token (for CLI/MCP). Raw token shown once. */
    @ApiBearerAuth('jwt')
    @ApiOperation({
        summary: 'Issue a long-lived API token',
        description: 'The raw token value is returned once and never stored in plaintext.',
    })
    @Post('tokens')
    @UseGuards(JwtAuthGuard)
    async createToken(
        @Request() req: JwtRequest,
        @Body() dto: CreateTokenDto,
    ): Promise<{ token: string; id: string; label: string }> {
        const { rawToken, record } = await this.apiTokens.create({ userId: req.user.sub, label: dto.label });

        return { token: rawToken, id: String(record._id), label: record.label };
    }

    /** List all API tokens for the current user (no raw values). */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'List API tokens for the authenticated user' })
    @Get('tokens')
    @UseGuards(CombinedAuthGuard)
    async listTokens(@Request() req: JwtRequest): Promise<{ id: string; label: string; lastUsedAt: Date | null }[]> {
        const tokens = await this.apiTokens.list(req.user.sub);

        return tokens.map((t) => ({ id: String(t._id), label: t.label, lastUsedAt: t.lastUsedAt }));
    }

    /** Revoke an API token by id. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Revoke an API token by id' })
    @ApiResponse({ status: 204 })
    @Delete('tokens/:id')
    @HttpCode(204)
    @UseGuards(CombinedAuthGuard)
    async revokeToken(@Request() req: JwtRequest, @Param('id') id: string): Promise<void> {
        await this.apiTokens.revoke({ tokenId: id, userId: req.user.sub });
    }
}
