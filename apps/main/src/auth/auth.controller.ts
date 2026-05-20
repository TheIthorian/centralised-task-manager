import { Body, Controller, HttpCode, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import type { UserDocument } from '../users/schemas/user.schema.js';

interface AuthRequest {
    user: UserDocument;
}

@Controller('auth')
export class AuthController {
    constructor(private readonly auth: AuthService) {}

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
}
