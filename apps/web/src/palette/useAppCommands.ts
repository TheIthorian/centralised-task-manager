import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { CommandItem } from '@ctm/ui';
import { useAuth } from '../auth/AuthContext.js';
import { useDensity, type Density } from '../theme/DensityContext.js';
import { useTheme } from '../theme/ThemeContext.js';

/** A palette entry plus the thing it does. The palette itself only renders; the app acts. */
export type AppCommand = CommandItem & { run: () => void };

const DENSITY_LABEL_KEYS = {
    compact: 'palette.commands.densityCompact',
    comfortable: 'palette.commands.densityComfortable',
    spacious: 'palette.commands.densitySpacious',
} as const satisfies Record<Density, string>;

/**
 * Builds the command catalogue for the current session. Every entry is something the user
 * could already reach by pointing; the palette is a faster route to it, never the only one.
 */
export function useAppCommands(): AppCommand[] {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { theme, toggle } = useTheme();
    const { density, setDensity } = useDensity();

    return useMemo((): AppCommand[] => {
        const go = (path: string): (() => void) => (): void => {
            void navigate(path);
        };

        const densityCommands = (Object.keys(DENSITY_LABEL_KEYS) as Density[]).map(
            (level): AppCommand => ({
                id: `density-${level}`,
                group: 'do',
                label: t(DENSITY_LABEL_KEYS[level]),
                hint: level === density ? t('palette.commands.currentHint') : undefined,
                keywords: 'density spacing rows',
                run: () => setDensity(level),
            }),
        );

        return [
            { id: 'view-tasks', group: 'views', label: t('palette.commands.tasks'), hint: '/tasks', run: go('/tasks') },
            {
                id: 'view-calendar',
                group: 'views',
                label: t('palette.commands.calendar'),
                hint: '/calendar',
                run: go('/calendar'),
            },
            {
                id: 'view-timeline',
                group: 'views',
                label: t('palette.commands.timeline'),
                hint: '/timeline',
                run: go('/timeline'),
            },
            {
                id: 'acct-connectors',
                group: 'acct',
                label: t('palette.commands.connectors'),
                keywords: 'todoist google sources integrations',
                run: go('/settings/connectors'),
            },
            {
                id: 'acct-profile',
                group: 'acct',
                label: t('palette.commands.profile'),
                keywords: 'account email password',
                run: go('/settings/profile'),
            },
            {
                id: 'acct-notifications',
                group: 'acct',
                label: t('palette.commands.notificationPrefs'),
                keywords: 'reminders email push',
                run: go('/settings/notifications'),
            },
            {
                id: 'acct-authorized-apps',
                group: 'acct',
                label: t('palette.commands.authorizedApps'),
                keywords: 'oauth clients revoke cli mcp',
                run: go('/settings/authorized-apps'),
            },
            {
                id: 'do-theme',
                group: 'do',
                label: theme === 'dark' ? t('palette.commands.lightMode') : t('palette.commands.darkMode'),
                keywords: 'theme appearance contrast',
                run: toggle,
            },
            ...densityCommands,
            {
                id: 'do-logout',
                group: 'do',
                label: t('palette.commands.logout'),
                keywords: 'sign out session',
                run: () => void logout(),
            },
        ];
    }, [density, logout, navigate, setDensity, t, theme, toggle]);
}
