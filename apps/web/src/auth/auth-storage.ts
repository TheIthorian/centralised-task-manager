import Cookies from 'js-cookie';
import type { UserDto } from '@ctm/api-client';

const ACCESS_TOKEN_KEY = 'ctm_access_token';
const REFRESH_TOKEN_KEY = 'ctm_refresh_token';
const USER_KEY = 'ctm_user';

export type StoredAuthTokens = {
    accessToken: string | null;
    refreshToken: string | null;
};

/** Read the persisted access and refresh tokens from cookies. */
export function readTokens(): StoredAuthTokens {
    return {
        accessToken: Cookies.get(ACCESS_TOKEN_KEY) ?? null,
        refreshToken: Cookies.get(REFRESH_TOKEN_KEY) ?? null,
    };
}

/** Persist the latest access and refresh tokens to cookies. */
export function writeTokens({ accessToken, refreshToken }: StoredAuthTokens): void {
    if (accessToken) {
        Cookies.set(ACCESS_TOKEN_KEY, accessToken, { sameSite: 'strict' });
    } else {
        Cookies.remove(ACCESS_TOKEN_KEY);
    }

    if (refreshToken) {
        Cookies.set(REFRESH_TOKEN_KEY, refreshToken, { sameSite: 'strict' });
    } else {
        Cookies.remove(REFRESH_TOKEN_KEY);
    }
}

/** Read the persisted user profile from cookies. */
export function readUser(): UserDto | null {
    const raw = Cookies.get(USER_KEY);

    if (!raw) return null;

    try {
        return JSON.parse(raw) as UserDto;
    } catch {
        Cookies.remove(USER_KEY);

        return null;
    }
}

/** Persist the current user profile to cookies. */
export function writeUser(user: UserDto): void {
    Cookies.set(USER_KEY, JSON.stringify(user), { sameSite: 'strict' });
}

/** Remove all persisted auth state. */
export function clearAuthStorage(): void {
    Cookies.remove(ACCESS_TOKEN_KEY);
    Cookies.remove(REFRESH_TOKEN_KEY);
    Cookies.remove(USER_KEY);
}
