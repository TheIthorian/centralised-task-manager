import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

const ACCESS_TOKEN_KEY = 'ctm_access_token';
const REFRESH_TOKEN_KEY = 'ctm_refresh_token';
const USER_KEY = 'ctm_user';

/** Read/write helpers so the rest of the package doesn't touch cookies directly. */
export const tokenStore = {
    getAccess: (): string | null => Cookies.get(ACCESS_TOKEN_KEY) ?? null,
    getRefresh: (): string | null => Cookies.get(REFRESH_TOKEN_KEY) ?? null,
    /** Persist a new access + refresh token pair to cookies. */
    set: (accessToken: string, refreshToken: string): void => {
        Cookies.set(ACCESS_TOKEN_KEY, accessToken, { sameSite: 'strict' });
        Cookies.set(REFRESH_TOKEN_KEY, refreshToken, { sameSite: 'strict' });
    },
    /** Remove all auth cookies (used on logout / auth failure). */
    clear: (): void => {
        Cookies.remove(ACCESS_TOKEN_KEY);
        Cookies.remove(REFRESH_TOKEN_KEY);
        Cookies.remove(USER_KEY);
    },
};

interface ExtendedConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

let _client: AxiosInstance | null = null;
let _baseURL = 'http://localhost:3000';
let _onAuthFailure: () => void = () => {
    if (typeof window !== 'undefined') window.location.href = '/login';
};

/**
 * Initialise the shared API client. Call once at app startup before any API calls.
 */
export function initClient(baseURL: string, onAuthFailure?: () => void): void {
    _baseURL = baseURL;

    if (onAuthFailure) _onAuthFailure = onAuthFailure;

    _client = createClient(_baseURL, _onAuthFailure);
}

/** Return the shared client, initialising with defaults if not yet set up. */
export function getClient(): AxiosInstance {
    if (!_client) _client = createClient(_baseURL, _onAuthFailure);

    return _client;
}

function createClient(baseURL: string, onAuthFailure: () => void): AxiosInstance {
    const instance = axios.create({ baseURL });

    instance.interceptors.request.use((config) => {
        const token = tokenStore.getAccess();

        if (token) config.headers.Authorization = `Bearer ${token}`;

        return config;
    });

    instance.interceptors.response.use(
        (res) => res,
        async (error: unknown) => {
            if (!axios.isAxiosError(error)) return Promise.reject(error);

            const config = error.config as ExtendedConfig | undefined;

            if (error.response?.status === 401 && config && !config._retry) {
                config._retry = true;
                const refreshToken = tokenStore.getRefresh();

                if (refreshToken) {
                    try {
                        const { data } = await axios.post<{
                            accessToken: string;
                            refreshToken: string;
                        }>(`${baseURL}/auth/refresh`, { refreshToken });

                        tokenStore.set(data.accessToken, data.refreshToken);
                        config.headers.Authorization = `Bearer ${data.accessToken}`;

                        return instance(config);
                    } catch {
                        tokenStore.clear();
                        onAuthFailure();
                    }
                }
            }

            return Promise.reject(error);
        },
    );

    return instance;
}
