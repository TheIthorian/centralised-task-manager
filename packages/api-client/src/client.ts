import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

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
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('ctm_access_token') : null;

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
                const refreshToken =
                    typeof localStorage !== 'undefined' ? localStorage.getItem('ctm_refresh_token') : null;

                if (refreshToken) {
                    try {
                        const { data } = await axios.post<{
                            accessToken: string;
                            refreshToken: string;
                        }>(`${baseURL}/auth/refresh`, { refreshToken });

                        localStorage.setItem('ctm_access_token', data.accessToken);
                        localStorage.setItem('ctm_refresh_token', data.refreshToken);
                        config.headers.Authorization = `Bearer ${data.accessToken}`;

                        return instance(config);
                    } catch {
                        localStorage.removeItem('ctm_access_token');
                        localStorage.removeItem('ctm_refresh_token');
                        localStorage.removeItem('ctm_user');
                        onAuthFailure();
                    }
                }
            }

            return Promise.reject(error);
        },
    );

    return instance;
}
