import { JwtService } from '@nestjs/jwt';

const BEARER_PREFIX = 'Bearer ';

/** Client id recorded for tokens issued by first-party login rather than the OAuth flow. */
export const FIRST_PARTY_CLIENT = 'first-party';

/** Marks a tracker as the per-client fence rather than the account ceiling. */
export const CLIENT_TRACKER_MARKER = '|client:';

/** Who is making a request, as far as rate limiting is concerned. */
export type Principal = {
    userId: string;
    clientId: string;
};

// Resolution result is cached on the request: four throttlers run per request and each one
// would otherwise repeat the signature check.
const CACHED_PRINCIPAL = Symbol('ctm:rate-limit-principal');

type CachingRequest = Record<string | symbol, unknown> & {
    [CACHED_PRINCIPAL]?: Principal | null;
};

/**
 * Resolves the calling principal from a request's bearer token.
 *
 * The rate-limit guard runs before the route's auth guard, so the principal is not on the
 * request yet and the token has to be verified here. An unverified token would let a caller
 * mint a fresh identity per request and skip the quota entirely.
 */
export class PrincipalResolver {
    private readonly jwt: JwtService;

    constructor({ publicKey }: { publicKey: string }) {
        this.jwt = new JwtService({ publicKey, verifyOptions: { algorithms: ['RS256'] } });
    }

    /** The verified principal, or null for anonymous traffic. */
    resolve(req: Record<string, unknown>): Principal | null {
        const request = req as CachingRequest;
        const cached = request[CACHED_PRINCIPAL];

        if (cached !== undefined) return cached;

        const principal = this.verify(req);

        request[CACHED_PRINCIPAL] = principal;

        return principal;
    }

    /**
     * The account-wide key — the ceiling. It has to sit on an identity the caller cannot
     * multiply for free, so it is the user id, and the client IP when there is no user.
     */
    accountKey(req: Record<string, unknown>): string {
        const principal = this.resolve(req);

        if (principal) return `user:${principal.userId}`;

        const ip = req['ip'];

        return `ip:${typeof ip === 'string' ? ip : 'unknown'}`;
    }

    /**
     * The per-client key — a fence, not a quota grant. It stops one of a user's clients (a
     * runaway CLI cron, say) from spending the whole account budget and 429ing their browser.
     */
    clientKey(req: Record<string, unknown>): string {
        const principal = this.resolve(req);

        if (!principal) return this.accountKey(req);

        return `user:${principal.userId}${CLIENT_TRACKER_MARKER}${principal.clientId}`;
    }

    private verify(req: Record<string, unknown>): Principal | null {
        const headers = req['headers'];

        if (typeof headers !== 'object' || headers === null) return null;

        const authorization = (headers as Record<string, unknown>)['authorization'];

        if (typeof authorization !== 'string' || !authorization.startsWith(BEARER_PREFIX)) return null;

        try {
            const payload = this.jwt.verify<Record<string, unknown>>(authorization.slice(BEARER_PREFIX.length));
            const userId = payload['sub'];

            if (typeof userId !== 'string') return null;

            const clientId = payload['client_id'];

            return { userId, clientId: typeof clientId === 'string' ? clientId : FIRST_PARTY_CLIENT };
        } catch {
            return null;
        }
    }
}
