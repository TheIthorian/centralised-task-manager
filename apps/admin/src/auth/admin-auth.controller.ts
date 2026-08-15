import { Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ValidatedBody } from '@ctm/nest-common';
import { ADMIN_SESSION_COOKIE } from './admin-session.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminLoginDto } from './dto/login.dto.js';
import { AdminSessionDto } from './dto/admin-session-response.dto.js';
import { Public } from './admin.guard.js';

@Controller('auth')
export class AdminAuthController {
    constructor(
        private readonly auth: AdminAuthService,
        private readonly config: ConfigService,
    ) {}

    /**
     * Exchange the operator credential for a session cookie.
     *
     * @throws RateLimitError when the credential is locked out.
     * @throws UnauthorizedError when the credential is wrong.
     */
    @Public()
    @Post('login')
    @HttpCode(200)
    async login(
        @ValidatedBody(AdminLoginDto) dto: AdminLoginDto,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply,
    ): Promise<AdminSessionDto> {
        const { token, expiresInSeconds } = await this.auth.login({
            username: dto.username,
            password: dto.password,
            ip: request.ip ?? null,
        });

        reply.setCookie(ADMIN_SESSION_COOKIE, token, this.cookieOptions(expiresInSeconds));

        return { username: dto.username, expiresInSeconds };
    }

    /** Drop the session cookie. Safe to call without a session. */
    @Public()
    @Post('logout')
    @HttpCode(204)
    logout(@Res({ passthrough: true }) reply: FastifyReply): void {
        reply.clearCookie(ADMIN_SESSION_COOKIE, this.cookieOptions(0));
    }

    // sameSite: 'strict' rather than 'lax' — nothing ever navigates into the admin app from
    // elsewhere, so there is no cross-site entry point worth preserving.
    private cookieOptions(maxAge: number): CookieSerializeOptions {
        return {
            httpOnly: true,
            secure: this.config.getOrThrow<boolean>('COOKIE_SECURE'),
            sameSite: 'strict',
            path: '/',
            maxAge,
        };
    }
}
