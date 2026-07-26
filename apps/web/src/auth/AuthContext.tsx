import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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

    const handleUnauthorized = (): void => {
        setAccessToken(null);
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
        let cancelled = false;

        const bootstrap = async (): Promise<void> => {
            try {
                const result = await api.refresh();

                if (cancelled) return;

                setAccessToken(result.accessToken);
                setUser(result.user);
            } catch {
                if (cancelled) return;

                setAccessToken(null);
                setUser(null);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void bootstrap();

        return () => {
            cancelled = true;
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
            setAccessToken(null);
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
