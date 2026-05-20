import { Body, Controller, Delete, Get, HttpCode, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
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

@Controller('auth')
export class AuthController {
    constructor(
        private readonly auth: AuthService,
        private readonly apiTokens: ApiTokenService,
    ) {}

    /** Register a new account. Returns a JWT. */
    @Post('register')
    async register(@Body() dto: RegisterDto): Promise<{ accessToken: string }> {
        return this.auth.register({ email: dto.email, password: dto.password });
    }

    /** Login with email + password. Returns a JWT. */
    @Post('login')
    @HttpCode(200)
    @UseGuards(AuthGuard('local'))
    login(@Request() req: AuthRequest): { accessToken: string } {
        return this.auth.signToken(req.user);
    }

    /** Issue a new long-lived API token (for CLI/MCP). Raw token shown once. */
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
    @Get('tokens')
    @UseGuards(CombinedAuthGuard)
    async listTokens(
        @Request() req: JwtRequest,
    ): Promise<{ id: string; label: string; lastUsedAt: Date | null }[]> {
        const tokens = await this.apiTokens.list(req.user.sub);

        return tokens.map((t) => ({ id: String(t._id), label: t.label, lastUsedAt: t.lastUsedAt }));
    }

    /** Revoke an API token by id. */
    @Delete('tokens/:id')
    @HttpCode(204)
    @UseGuards(CombinedAuthGuard)
    async revokeToken(@Request() req: JwtRequest, @Param('id') id: string): Promise<void> {
        await this.apiTokens.revoke({ tokenId: id, userId: req.user.sub });
    }
}
