import { Controller, Delete, Get, HttpCode, Patch, Request, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { UserDto } from './dto/user.dto.js';
import { ValidatedBody } from '../common/validation/validated.decorators.js';

interface AuthRequest {
    user: JwtPayload;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(
        private readonly users: UsersService,
        private readonly auth: AuthService,
    ) {}

    /** Get the current user's profile. */
    @ApiOperation({ summary: 'Get current user' })
    @Get('me')
    async me(@Request() req: AuthRequest): Promise<UserDto> {
        const user = await this.users.findById(req.user.sub);

        if (!user) throw new NotFoundException('User not found');

        return { id: String(user._id), email: user.email };
    }

    /** Update the current user's email or password. */
    @ApiOperation({ summary: 'Update current user' })
    @Patch('me')
    async update(@Request() req: AuthRequest, @ValidatedBody(UpdateUserDto) dto: UpdateUserDto): Promise<UserDto> {
        const user = await this.users.update({ id: req.user.sub, dto });

        return { id: String(user._id), email: user.email };
    }

    /** Delete the current user's account and all associated data permanently. */
    @ApiOperation({ summary: 'Delete current user' })
    @Delete('me')
    @HttpCode(204)
    async deleteMe(@Request() req: AuthRequest): Promise<void> {
        const userId = req.user.sub;

        await this.auth.revokeAllRefreshTokens(userId);

        await this.users.delete(userId);
    }
}
