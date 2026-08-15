import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ADMIN_SESSION_COOKIE, type AdminSessionClaims } from './admin-session.js';
import { AdminAuthService } from './admin-auth.service.js';

const IS_PUBLIC = 'admin:isPublic';

/** Marks a route as reachable without a session. Only the login route should use it. */
export const Public = (): MethodDecorator => SetMetadata(IS_PUBLIC, true);

/** A request that has passed the guard, with the verified session attached. */
export type AdminRequest = FastifyRequest & { admin: AdminSessionClaims };

/**
 * Rejects every request without a valid admin session cookie.
 *
 * Registered globally rather than per controller: a new admin endpoint is protected by default,
 * and exposing one takes the deliberate act of marking it `@Public()`.
 */
@Injectable()
export class AdminGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly auth: AdminAuthService,
    ) {}

    /** @throws UnauthorizedError when the session cookie is missing or invalid. */
    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) return true;

        const request = context.switchToHttp().getRequest<AdminRequest>();

        request.admin = this.auth.verifySession(request.cookies?.[ADMIN_SESSION_COOKIE]);

        return true;
    }
}
