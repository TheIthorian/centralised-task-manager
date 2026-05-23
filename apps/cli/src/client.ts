import { CtmApiClient } from '@ctm/api-client';
import { readConfig } from './auth.js';

export const DEFAULT_BASE_URL = 'http://localhost:3000';

/** Options accepted by {@link buildClient}. */
export type ClientOptions = {
    token?: string;
    baseUrl?: string;
};

/**
 * Build a CtmApiClient from:
 * 1. --token flag / CTM_TOKEN env var
 * 2. Stored config (~/.config/ctm/config.json)
 * Falls back to unauthenticated client if no token found.
 */
export function buildClient({ token, baseUrl }: ClientOptions): CtmApiClient {
    const envToken = process.env['CTM_TOKEN'];
    const envBaseUrl = process.env['CTM_BASE_URL'];
    const config = readConfig();

    const resolvedToken = token ?? envToken ?? config?.accessToken ?? null;
    const resolvedBaseUrl = baseUrl ?? envBaseUrl ?? config?.baseUrl ?? DEFAULT_BASE_URL;
    // Only use the stored refresh token when we're actually using the stored access token
    const usingStoredToken = token == null && envToken == null && config?.accessToken != null;
    const refreshToken = usingStoredToken ? (config?.refreshToken ?? null) : null;

    return new CtmApiClient({
        baseUrl: resolvedBaseUrl,
        accessToken: resolvedToken,
        refreshToken,
    });
}
