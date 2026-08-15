import type { AuthTokens, TokenPersistence } from './http.types.js';
import { TokenGrant } from './http.types.js';

/**
 * Refresh with this much of the access token's life left, so a call made just under the wire does
 * not expire in flight. Access tokens are minted with a two-minute lifetime by default.
 */
const REFRESH_LEEWAY_SECONDS = 30;

/**
 * Keeps a client's access token current.
 *
 * The two login flows write to separate token collections and each endpoint only redeems its own,
 * so the grant decides where the refresh goes. Persistence is injected: this package never decides
 * where a consumer keeps its credentials.
 */
export class TokenRefresher {
    private readonly baseUrl: string;
    private readonly persistence: TokenPersistence | undefined;
    private tokens: AuthTokens;
    private inFlight: Promise<AuthTokens> | null = null;

    constructor({
        baseUrl,
        tokens,
        persistence,
    }: {
        baseUrl: string;
        tokens: AuthTokens;
        persistence?: TokenPersistence;
    }) {
        this.baseUrl = baseUrl;
        this.tokens = tokens;
        this.persistence = persistence;
    }

    /** The current access token, refreshed first if it is at or near expiry. */
    async accessToken(): Promise<string | null> {
        if (this.tokens.accessToken !== null && !isExpiring(this.tokens.accessToken)) return this.tokens.accessToken;

        if (this.tokens.refreshToken === null) return this.tokens.accessToken;

        try {
            return (await this.refresh()).accessToken;
        } catch {
            // The caller's request still goes out and reports the API's own error, which says more
            // than a refresh failure would.
            return this.tokens.accessToken;
        }
    }

    /**
     * Force a refresh, e.g. after a 401 from a token that looked valid. Concurrent callers share
     * one request: the refresh token is single-use, so a second exchange would revoke the first.
     */
    async refresh(): Promise<AuthTokens> {
        this.inFlight ??= this.exchange().finally(() => {
            this.inFlight = null;
        });

        return this.inFlight;
    }

    private async exchange(): Promise<AuthTokens> {
        const { refreshToken, grant } = this.tokens;

        if (refreshToken === null) throw new Error('No refresh token to exchange');

        const tokens =
            grant === TokenGrant.OAuth
                ? await this.exchangeOAuth(refreshToken)
                : await this.exchangeSession(refreshToken);

        this.tokens = tokens;

        await this.persistence?.onTokensRefreshed(tokens);

        return tokens;
    }

    private async exchangeOAuth(refreshToken: string): Promise<AuthTokens> {
        const response = await fetch(`${this.baseUrl}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }),
        });

        if (!response.ok) throw new Error(`Token refresh failed: ${response.status}`);

        const body = (await response.json()) as { access_token: string; refresh_token: string };

        return { accessToken: body.access_token, refreshToken: body.refresh_token, grant: TokenGrant.OAuth };
    }

    private async exchangeSession(refreshToken: string): Promise<AuthTokens> {
        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) throw new Error(`Token refresh failed: ${response.status}`);

        const body = (await response.json()) as { accessToken: string; refreshToken?: string };

        return {
            accessToken: body.accessToken,
            // Web clients get the rotated token as an HttpOnly cookie rather than in the body.
            refreshToken: body.refreshToken ?? refreshToken,
            grant: TokenGrant.Session,
        };
    }
}

/**
 * True when the token expires within the leeway, or carries no readable expiry. The payload is
 * read without verifying the signature: the server remains the authority, this only decides
 * whether to spend a round trip.
 */
export function isExpiring(accessToken: string): boolean {
    const expiresAt = expiryOf(accessToken);

    if (expiresAt === null) return true;

    return expiresAt - Date.now() / 1000 <= REFRESH_LEEWAY_SECONDS;
}

function expiryOf(accessToken: string): number | null {
    const payload = accessToken.split('.')[1];

    if (payload === undefined) return null;

    try {
        const decoded: unknown = JSON.parse(decodeBase64Url(payload));

        if (typeof decoded !== 'object' || decoded === null) return null;

        const exp = (decoded as Record<string, unknown>)['exp'];

        return typeof exp === 'number' ? exp : null;
    } catch {
        return null;
    }
}

// Buffer is not available in a browser and atob is the one decoder both runtimes have.
function decodeBase64Url(value: string): string {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');

    return atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='));
}
