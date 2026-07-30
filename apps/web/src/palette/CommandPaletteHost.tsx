import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CommandPalette, type CommandItem } from '@ctm/ui';
import { useAppCommands } from './useAppCommands.js';

/** Mounts the command palette and owns the one shortcut that opens it. */
export function CommandPaletteHost(): React.JSX.Element {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const commands = useAppCommands();
    const { pathname } = useLocation();

    const close = useCallback((): void => setOpen(false), []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key !== 'k' || !(event.metaKey || event.ctrlKey)) return;

            // Chrome binds Ctrl+K to the address bar and Safari to a tab search, so the
            // default has to go before the palette can have the chord.
            event.preventDefault();
            setOpen((current) => !current);
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    // A command that navigates leaves the palette open over the new screen otherwise.
    useEffect(close, [pathname, close]);

    const run = (item: CommandItem): void => {
        close();
        commands.find((command) => command.id === item.id)?.run();
    };

    return (
        <>
            {/* A phone has no ⌘K, and a shortcut nobody is told about is a shortcut nobody
                uses, so the chord gets a visible control next to the bell. */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={t('palette.open')}
                className="fixed right-16 top-3 z-30 flex h-11 items-center justify-center md:right-14 md:h-9 rounded-ctm border border-line bg-panel px-2.5 font-mono text-[11px] text-muted transition-colors duration-press hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
                <span aria-hidden="true">⌘K</span>
            </button>

            <CommandPalette
            open={open}
            items={commands}
            onClose={close}
            onRun={run}
            labels={{
                title: t('palette.label'),
                placeholder: t('palette.placeholder'),
                noMatch: t('palette.noMatch'),
                groups: {
                    jump: t('palette.groups.jump'),
                    views: t('palette.groups.views'),
                    task: t('palette.groups.task'),
                    acct: t('palette.groups.acct'),
                    do: t('palette.groups.do'),
                    ask: t('palette.groups.ask'),
                },
                hints: {
                    move: t('palette.hints.move'),
                    run: t('palette.hints.run'),
                    close: t('palette.hints.close'),
                    prefixes: t('palette.hints.prefixes'),
                },
            }}
            />
        </>
    );
}
