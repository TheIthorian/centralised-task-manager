import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { UserDto } from '@ctm/api-client';
import { WebApiClient } from '../api/web-api-client.js';
import { useToast } from '../toast/ToastContext.js';
import config from '../config.js';

type AuthContextValue = {
    user: UserDto | null;
    isLoading: boolean;
    api: WebApiClient;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (user: UserDto) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Provides auth state. Wrap your router tree with this. */
export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
    const [user, setUser] = useState<UserDto | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    // Held in state (not storage) purely so React re-renders when the token changes;
    // consumers that need the value read it via `api.getAccessToken()`.
    const [, setAccessToken] = useState<string | null>(null);
    const { showToast } = useToast();
    const bootstrapRef = useRef<Promise<void> | null>(null);
    const isMountedRef = useRef(false);

    const handleUnauthorized = (): void => {
        api.clearTokens();
        setUser(null);
        window.location.href = '/login';
    };

    // Recreating this per render would drop in-flight refresh state and re-run the
    // bootstrap effect below.
    const api = useMemo(
        () =>
            new WebApiClient({
                baseUrl: config.apiUrl,
                accessToken: null,
                onTokens: (nextTokens) => {
                    setAccessToken(nextTokens.accessToken);
                },
                onUnauthorized: handleUnauthorized,
                onError: (error) => {
                    if (error.code === 'rate_limited') {
                        showToast({
                            title: 'Slow Down',
                            description: error.retryAfterSeconds
                                ? `Too many requests. Try again in ${error.retryAfterSeconds}s.`
                                : 'Too many requests. Try again shortly.',
                            dedupeKey: 'rate_limited',
                        });

                        return;
                    }

                    showToast({
                        title: 'Request Failed',
                        description: error.message,
                    });
                },
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    useEffect(() => {
        // Refresh tokens rotate, so two bootstraps would 401 the second one and log out a
        // valid session — which StrictMode's double-invoke causes in dev. `bootstrapRef`
        // shares one in-flight promise; `isMountedRef` lets whichever invocation is live
        // when it resolves apply the result.
        isMountedRef.current = true;

        if (!bootstrapRef.current) {
            bootstrapRef.current = (async (): Promise<void> => {
                try {
                    const result = await api.refresh();

                    if (isMountedRef.current) {
                        setAccessToken(result.accessToken);
                        setUser(result.user);
                    }
                } catch {
                    if (isMountedRef.current) {
                        setAccessToken(null);
                        setUser(null);
                    }
                } finally {
                    if (isMountedRef.current) setIsLoading(false);

                    bootstrapRef.current = null;
                }
            })();
        }

        return () => {
            isMountedRef.current = false;
        };
    }, [api]);

    const login = async (email: string, password: string): Promise<void> => {
        const result = await api.login({ email, password });

        setAccessToken(result.accessToken);
        setUser(result.user);
    };

    const register = async (name: string, email: string, password: string): Promise<void> => {
        const result = await api.register({ name, email, password });

        setAccessToken(result.accessToken);
        setUser(result.user);
    };

    const logout = async (): Promise<void> => {
        try {
            await api.logout();
        } catch {
            // Looking logged in after clicking logout is worse than a stale server token.
        } finally {
            api.clearTokens();
            setUser(null);
        }
    };

    const updateUser = (nextUser: UserDto): void => {
        setUser(nextUser);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, api, login, register, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

/** Returns auth context. Must be used inside AuthProvider. */
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);

    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');

    return ctx;
}
