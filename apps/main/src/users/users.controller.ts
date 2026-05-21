import { Controller, Delete, Get, HttpCode, Patch, Body, Request, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { ApiTokenService } from '../auth/api-token.service.js';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

interface AuthRequest {
    user: JwtPayload;
}

@Controller('users')
@UseGuards(CombinedAuthGuard)
export class UsersController {
    constructor(
        private readonly users: UsersService,
        private readonly auth: AuthService,
        private readonly apiTokens: ApiTokenService,
    ) {}

    /** Get the current user's profile. */
    @ApiOperation({ summary: 'Get current user' })
    @Get('me')
    async me(@Request() req: AuthRequest): Promise<{ id: string; email: string }> {
        const user = await this.users.findById(req.user.sub);

        if (!user) throw new NotFoundException('User not found');

        return { id: String(user._id), email: user.email };
    }

    /** Update the current user's email or password. */
    @ApiOperation({ summary: 'Update current user' })
    @Patch('me')
    async update(@Request() req: AuthRequest, @Body() dto: UpdateUserDto): Promise<{ id: string; email: string }> {
        const user = await this.users.update({ id: req.user.sub, dto });

        return { id: String(user._id), email: user.email };
    }

    /** Delete the current user's account and all associated data permanently. */
    @ApiOperation({ summary: 'Delete current user' })
    @Delete('me')
    @HttpCode(204)
    async deleteMe(@Request() req: AuthRequest): Promise<void> {
        const userId = req.user.sub;

        await Promise.all([this.auth.revokeAllRefreshTokens(userId), this.apiTokens.deleteAllByUserId(userId)]);

        await this.users.delete(userId);
    }
}
