import { createContext, useContext, useEffect, useState } from 'react';
import { MissingProviderError } from '../lib/errors.js';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
    theme: Theme;
    toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) ?? 'light');

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggle = (): void => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

    return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

/** Access the current theme and toggle function. */
export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);

    if (!ctx) throw new MissingProviderError({ hook: 'useTheme', provider: 'ThemeProvider' });

    return ctx;
}
