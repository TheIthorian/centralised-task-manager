import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import Cookies from 'js-cookie';
import { login as apiLogin, register as apiRegister, tokenStore } from '@ctm/api-client';
import type { UserDto } from '@ctm/api-client';

const USER_COOKIE = 'ctm_user';

interface AuthContextValue {
    user: UserDto | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readUser(): UserDto | null {
    const raw = Cookies.get(USER_COOKIE);

    if (!raw) return null;

    try {
        return JSON.parse(raw) as UserDto;
    } catch {
        Cookies.remove(USER_COOKIE);

        return null;
    }
}

/** Provides auth state. Wrap your router tree with this. */
export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
    const [user, setUser] = useState<UserDto | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setUser(readUser());
        setIsLoading(false);
    }, []);

    const login = async (email: string, password: string): Promise<void> => {
        const result = await apiLogin(email, password);

        tokenStore.set(result.accessToken, result.refreshToken);
        Cookies.set(USER_COOKIE, JSON.stringify(result.user), { sameSite: 'strict' });
        setUser(result.user);
    };

    const register = async (name: string, email: string, password: string): Promise<void> => {
        const result = await apiRegister(name, email, password);

        tokenStore.set(result.accessToken, result.refreshToken);
        Cookies.set(USER_COOKIE, JSON.stringify(result.user), { sameSite: 'strict' });
        setUser(result.user);
    };

    const logout = (): void => {
        tokenStore.clear();
        setUser(null);
    };

    return <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>{children}</AuthContext.Provider>;
}

/** Returns auth context. Must be used inside AuthProvider. */
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);

    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');

    return ctx;
}
