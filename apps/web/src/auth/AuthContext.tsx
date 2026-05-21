import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserDto } from '@ctm/api-client';
import { WebApiClient } from '../api/web-api-client.js';
import { clearAuthStorage, readTokens, readUser, writeTokens, writeUser } from './auth-storage.js';
import { useToast } from '../toast/ToastContext.js';

type AuthContextValue = {
    user: UserDto | null;
    isLoading: boolean;
    api: WebApiClient;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    updateUser: (user: UserDto) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Provides auth state. Wrap your router tree with this. */
export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
    const [user, setUser] = useState<UserDto | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [tokens, setTokens] = useState(readTokens);
    const { showToast } = useToast();

    useEffect(() => {
        setUser(readUser());
        setTokens(readTokens());
        setIsLoading(false);
    }, []);

    const handleUnauthorized = (): void => {
        clearAuthStorage();
        setTokens({ accessToken: null, refreshToken: null });
        setUser(null);
        window.location.href = '/login';
    };

    const api = new WebApiClient({
        baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        onTokens: (nextTokens) => {
            writeTokens(nextTokens);
            setTokens(nextTokens);
        },
        onUnauthorized: handleUnauthorized,
        onError: (error) => {
            showToast({
                title: 'Request Failed',
                description: error.message,
            });
        },
    });

    const login = async (email: string, password: string): Promise<void> => {
        const result = await api.login({ email, password });

        writeTokens({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });
        setTokens({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });
        writeUser(result.user);
        setUser(result.user);
    };

    const register = async (name: string, email: string, password: string): Promise<void> => {
        const result = await api.register({ name, email, password });

        writeTokens({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });
        setTokens({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });
        writeUser(result.user);
        setUser(result.user);
    };

    const logout = (): void => {
        clearAuthStorage();
        setTokens({ accessToken: null, refreshToken: null });
        setUser(null);
    };

    const updateUser = (nextUser: UserDto): void => {
        writeUser(nextUser);
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
