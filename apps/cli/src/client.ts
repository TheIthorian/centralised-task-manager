import { CtmApiClient } from '@ctm/api-client';
import { ConfigurationError } from '@ctm/errors';
import { readConfig } from './auth.js';
import { bakedBaseUrl } from './baked-config.js';

/** Options accepted by {@link buildClient}. */
export type ClientOptions = {
    token?: string;
    baseUrl?: string;
};

/**
 * Build a CtmApiClient. Tokens resolve from the --token flag, the CTM_TOKEN env var, then the
 * stored config (~/.config/ctm/config.json); an unauthenticated client is returned if none is
 * found. Base URL resolves from --base-url, CTM_BASE_URL, the stored config, then the URL baked
 * in at bundle time.
 *
 * @throws ConfigurationError when no base URL can be resolved.
 */
export function buildClient({ token, baseUrl }: ClientOptions): CtmApiClient {
    const envToken = process.env['CTM_TOKEN'];
    const envBaseUrl = process.env['CTM_BASE_URL'];
    const config = readConfig();

    const resolvedToken = token ?? envToken ?? config?.accessToken ?? null;
    const resolvedBaseUrl = baseUrl ?? envBaseUrl ?? config?.baseUrl ?? bakedBaseUrl();

    if (!resolvedBaseUrl) {
        throw new ConfigurationError(
            'Base URL must be provided via --base-url flag, CTM_BASE_URL env var, or config file',
        );
    }

    // Only use the stored refresh token when we're actually using the stored access token
    const usingStoredToken = token == null && envToken == null && config?.accessToken != null;
    const refreshToken = usingStoredToken ? (config?.refreshToken ?? null) : null;

    return new CtmApiClient({
        baseUrl: resolvedBaseUrl,
        accessToken: resolvedToken,
        refreshToken,
    });
}
