import { CtmApiClient } from '@ctm/api-client';
import { ConfigurationError } from '@ctm/errors';
import { readConfig, readSession, updateStoredTokens } from './auth.js';
import { bakedBaseUrl } from './baked-config.js';
import { normalizeBaseUrl } from './base-url.js';

/** Options accepted by {@link buildClient}. */
export type ClientOptions = {
    token?: string;
    baseUrl?: string;
};

/**
 * Build a CtmApiClient. Tokens resolve from the --token flag, the CTM_TOKEN env var, then the
 * stored session; an unauthenticated client is returned if none is found. Base URL resolves from
 * --base-url, CTM_BASE_URL, the stored config, then the URL baked in at bundle time.
 *
 * The client refreshes the two-minute access token itself and writes the rotated pair back to the
 * secret store through the persistence hook.
 *
 * @throws ConfigurationError when no base URL can be resolved.
 */
export function buildClient({ token, baseUrl }: ClientOptions): CtmApiClient {
    const envToken = process.env['CTM_TOKEN'];
    const envBaseUrl = process.env['CTM_BASE_URL'];
    const explicitToken = token ?? envToken ?? null;
    const resolvedBaseUrl = resolveBaseUrl({ baseUrl, envBaseUrl });

    // An explicit token is used as given: it is not ours to refresh or to persist, and it may
    // belong to a different account than the stored session.
    if (explicitToken !== null) {
        return new CtmApiClient({ baseUrl: resolvedBaseUrl, accessToken: explicitToken });
    }

    const session = readSession();

    if (!session) return new CtmApiClient({ baseUrl: resolvedBaseUrl, accessToken: null });

    return new CtmApiClient({
        baseUrl: resolvedBaseUrl,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        grant: session.grant,
        persistence: {
            onTokensRefreshed: ({ accessToken, refreshToken, grant }): void => {
                if (accessToken === null || refreshToken === null) return;

                updateStoredTokens({ baseUrl: resolvedBaseUrl, tokens: { accessToken, refreshToken, grant } });
            },
        },
    });
}

function resolveBaseUrl({ baseUrl, envBaseUrl }: { baseUrl?: string; envBaseUrl?: string }): string {
    const resolved = baseUrl ?? envBaseUrl ?? readConfig()?.baseUrl ?? bakedBaseUrl();

    if (!resolved) {
        throw new ConfigurationError(
            'Base URL must be provided via --base-url flag, CTM_BASE_URL env var, or config file',
        );
    }

    return normalizeBaseUrl(resolved);
}
