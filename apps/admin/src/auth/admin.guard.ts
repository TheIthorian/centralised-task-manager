import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { ACCESS_JWT_COOKIE, ACCESS_JWT_HEADER, type AccessIdentity } from './access-identity.js';
import { AccessVerifierService } from './access-verifier.service.js';

/** A request that has passed the guard, with the verified operator attached. */
export type AdminRequest = FastifyRequest & { operator: AccessIdentity };

/**
 * Rejects every request Cloudflare Access did not vouch for.
 *
 * Registered globally rather than per controller: a new admin endpoint is protected by default,
 * and there is no `@Public()` escape hatch, because nothing on an operator surface should be
 * reachable without an identity.
 *
 * This app must only ever be reachable through Access. Exposing its origin directly makes the
 * header the only thing standing in front of it, and a header is trivial to forge.
 */
@Injectable()
export class AdminGuard implements CanActivate {
    constructor(
        private readonly verifier: AccessVerifierService,
        private readonly config: ConfigService,
    ) {}

    /** @throws UnauthorizedError when the request carries no valid Access token. */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<AdminRequest>();
        const bypassEmail = this.config.get<string>('ADMIN_DEV_BYPASS_EMAIL');

        // Local development has no Access in front of it. The env schema refuses to let this be
        // set when NODE_ENV=production, so it cannot be the reason a deployed server is open.
        if (bypassEmail) {
            request.operator = { email: bypassEmail, subject: 'dev-bypass' };

            return true;
        }

        request.operator = await this.verifier.verify(this.tokenFrom(request));

        return true;
    }

    // Access sends the header on every request it proxies and also sets the cookie, which is what
    // survives a direct browser navigation to the app.
    private tokenFrom(request: FastifyRequest): string | undefined {
        const header = request.headers[ACCESS_JWT_HEADER];

        if (typeof header === 'string') return header;

        return request.cookies?.[ACCESS_JWT_COOKIE];
    }
}
