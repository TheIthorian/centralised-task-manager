import { getClient } from './client.js';
import type { TokenPair } from './types.js';

/** Login with email and password. Returns token pair + user. */
export async function login(email: string, password: string): Promise<TokenPair> {
    const { data } = await getClient().post<TokenPair>('/auth/login', { email, password });

    return data;
}

/** Register a new account. Returns token pair + user. */
export async function register(name: string, email: string, password: string): Promise<TokenPair> {
    const { data } = await getClient().post<TokenPair>('/auth/register', { name, email, password });

    return data;
}

/** Exchange a refresh token for a new token pair. */
export async function refresh(refreshToken: string): Promise<TokenPair> {
    const { data } = await getClient().post<TokenPair>('/auth/refresh', { refreshToken });

    return data;
}
