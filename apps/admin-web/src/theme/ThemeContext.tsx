import { createContext, useContext, useEffect, useState } from 'react';
import { MissingProviderError } from '../lib/errors.js';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
    theme: Theme;
    toggle: () => void;
};

const STORAGE_KEY = 'ctm-admin-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'light');

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);

    const toggle = (): void => setTheme((current) => (current === 'light' ? 'dark' : 'light'));

    return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

/** Access the current theme and its toggle. */
export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);

    if (!context) throw new MissingProviderError({ hook: 'useTheme', provider: 'ThemeProvider' });

    return context;
}
