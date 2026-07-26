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
    // See the bootstrap effect below for why these are refs rather than plain closure
    // variables.
    const bootstrapRef = useRef<Promise<void> | null>(null);
    const isMountedRef = useRef(false);

    const handleUnauthorized = (): void => {
        api.clearTokens();
        setUser(null);
        window.location.href = '/login';
    };

    // Constructed once and mutated in place by setTokens; recreating it per render would
    // both defeat the mount-only bootstrap effect below and drop in-flight refresh state.
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
        // React 18 StrictMode double-invokes this effect in dev (mount → cleanup →
        // mount) within the same tick. Without this guard, each invocation calls
        // `api.refresh()` independently; the second rotates the cookie the first one
        // already consumed and comes back 401, logging out a session that was actually
        // valid. `bootstrapRef` shares one in-flight promise across every invocation —
        // combined with `WebApiClient`'s own single-flight in `refreshOnce`, this is
        // belt-and-braces against starting a second HTTP request. `isMountedRef` tracks
        // *current* mount state (not the mount state at the time the promise was
        // created), so the result is applied by whichever invocation is live when it
        // resolves.
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
            // Server-side revocation failed (network error, 5xx, etc). We still drop the
            // local session below — staying visually logged in after a failed logout is
            // worse than a stale server-side token, and `api.logout()` already suppresses
            // its own toast (toastOnError: false), so we swallow silently here too rather
            // than surface a toast on the way out the door.
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
