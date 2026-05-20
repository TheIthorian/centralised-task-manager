import { Controller, Get, Patch, Body, Request, UseGuards, NotFoundException } from '@nestjs/common';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

interface AuthRequest {
    user: JwtPayload;
}

@Controller('users')
@UseGuards(CombinedAuthGuard)
export class UsersController {
    constructor(private readonly users: UsersService) {}

    /** Get the current user's profile. */
    @Get('me')
    async me(@Request() req: AuthRequest): Promise<{ id: string; email: string }> {
        const user = await this.users.findById(req.user.sub);

        if (!user) throw new NotFoundException('User not found');

        return { id: String(user._id), email: user.email };
    }

    /** Update the current user's email or password. */
    @Patch('me')
    async update(
        @Request() req: AuthRequest,
        @Body() dto: UpdateUserDto,
    ): Promise<{ id: string; email: string }> {
        const user = await this.users.update({ id: req.user.sub, dto });

        return { id: String(user._id), email: user.email };
    }
}
