import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Kbd } from './Kbd.js';

export type CommandGroup = 'jump' | 'views' | 'task' | 'acct' | 'do' | 'ask';

export type CommandItem = {
    id: string;
    group: CommandGroup;
    label: string;
    hint?: string;
    icon?: React.ReactNode;
    /** Extra text to match against, for terms that are not in the label. */
    keywords?: string;
};

/** Every string the palette renders. The app owns the catalogue, so it passes translations in. */
export type CommandPaletteLabels = {
    title: string;
    placeholder: string;
    noMatch: string;
    groups: Record<CommandGroup, string>;
    hints: { move: string; run: string; close: string; prefixes: string };
};

export type CommandPaletteProps = {
    open: boolean;
    items: CommandItem[];
    onClose: () => void;
    onRun: (item: CommandItem) => void;
    /** Called when the query matches nothing. The string goes to the agent unchanged. */
    onAsk?: (query: string) => void;
    labels?: Partial<CommandPaletteLabels>;
};

const DEFAULT_LABELS: CommandPaletteLabels = {
    title: 'Command palette',
    placeholder: 'Search tasks, jump, or run a command',
    noMatch: 'Nothing matches. Press Enter to hand it to your agent instead.',
    groups: {
        jump: 'Jump to',
        views: 'Views',
        task: 'Tasks',
        acct: 'Accounts',
        do: 'Actions',
        ask: 'Ask',
    },
    hints: { move: 'move', run: 'run', close: 'close', prefixes: '> actions · # views · @ accounts' },
};

const GROUP_ORDER: CommandGroup[] = ['views', 'task', 'acct', 'jump', 'do', 'ask'];

const PREFIXES: Record<string, CommandGroup> = {
    '>': 'do',
    '#': 'views',
    '@': 'acct',
};

const LIST_ID = 'ctm-palette-list';

/**
 * One keystroke for search, navigation, actions and questions. Replaces an always-on
 * command bar, which costs vertical space on every screen and invites typing where nobody
 * is looking.
 */
export function CommandPalette({
    open,
    items,
    onClose,
    onRun,
    onAsk,
    labels,
}: CommandPaletteProps): React.JSX.Element | null {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const copy: CommandPaletteLabels = {
        ...DEFAULT_LABELS,
        ...labels,
        groups: { ...DEFAULT_LABELS.groups, ...labels?.groups },
        hints: { ...DEFAULT_LABELS.hints, ...labels?.hints },
    };

    useEffect(() => {
        if (!open) return;

        setQuery('');
        setSelected(0);

        // Escape has to give the keyboard back to whatever opened the palette, otherwise
        // focus lands on the body and the next Tab restarts at the top of the page.
        const opener = document.activeElement;

        inputRef.current?.focus();

        return () => {
            if (opener instanceof HTMLElement) opener.focus();
        };
    }, [open]);

    const matches = useMemo((): CommandItem[] => {
        const prefix = PREFIXES[query.slice(0, 1)];
        const term = (prefix ? query.slice(1) : query).trim().toLowerCase();
        const scoped = prefix ? items.filter((item) => item.group === prefix) : items;
        const hit = (item: CommandItem): boolean =>
            !term || `${item.label} ${item.keywords ?? ''}`.toLowerCase().includes(term);

        return scoped.filter(hit).sort(
            (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
        );
    }, [items, query]);

    if (!open) return null;

    const askQuery = query.replace(/^[>#@]/, '').trim();
    const active = matches[selected];

    const handleKeyDown = (e: React.KeyboardEvent): void => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();

            return;
        }

        // The input is the only focusable thing in the dialog, so trapping focus is a
        // matter of refusing to let Tab leave it.
        if (e.key === 'Tab') {
            e.preventDefault();
            inputRef.current?.focus();

            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelected((s) => Math.min(s + 1, matches.length - 1));

            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelected((s) => Math.max(s - 1, 0));

            return;
        }

        if (e.key !== 'Enter') return;

        e.preventDefault();

        if (active) onRun(active);
        else if (askQuery && onAsk) onAsk(askQuery);
    };

    let lastGroup: CommandGroup | undefined;

    return (
        <div
            role="presentation"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            onKeyDown={handleKeyDown}
            className={clsx(
                // items-start, or the grid stretches the dialog to the bottom of the window.
                // A phone keeps the dialog near the top: 12vh plus a software keyboard puts
                // the input under the keyboard, and vh does not shrink when it opens.
                'fixed inset-0 z-50 grid items-start justify-items-center pt-4 md:pt-[12vh]',
                // The blur is the point: the dialog floats above the app rather than being
                // pasted onto it, and the app stays recognisable underneath. It survives
                // reduced motion, because only the entry movement is motion.
                'bg-bg/50 backdrop-blur-[7px] backdrop-saturate-150',
                'motion-safe:animate-[ctm-fade_140ms_ease-out]',
            )}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={copy.title}
                className={clsx(
                    'w-[min(520px,90vw)] overflow-hidden rounded-[12px] border border-fg/15',
                    'bg-panel/90 shadow-overlay',
                    'motion-safe:animate-[ctm-rise_180ms_cubic-bezier(.2,.8,.3,1)]',
                )}
            >
                <div className="flex items-center gap-2.5 border-b border-hair bg-fg/3 px-3.5 py-3">
                    <Kbd>⌘K</Kbd>
                    <input
                        ref={inputRef}
                        role="combobox"
                        aria-expanded="true"
                        aria-controls={LIST_ID}
                        aria-activedescendant={active ? `${LIST_ID}-${active.id}` : undefined}
                        aria-label={copy.placeholder}
                        placeholder={copy.placeholder}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelected(0);
                        }}
                        className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-muted focus:outline-none"
                    />
                </div>
                <div
                    id={LIST_ID}
                    role="listbox"
                    aria-label={copy.title}
                    className="max-h-[min(300px,45dvh)] overflow-y-auto"
                >
                    {matches.map((item, index) => {
                        const heading = item.group === lastGroup ? null : copy.groups[item.group];
                        lastGroup = item.group;

                        // Headings are siblings of the options rather than wrappers, because a
                        // listbox may only own options and groups.
                        return (
                            <div key={item.id} className="contents">
                                {heading && (
                                    <div
                                        role="presentation"
                                        className="px-3.5 pb-1 pt-2.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted"
                                    >
                                        {heading}
                                    </div>
                                )}
                                <div
                                    id={`${LIST_ID}-${item.id}`}
                                    role="option"
                                    aria-selected={index === selected}
                                    onMouseEnter={() => setSelected(index)}
                                    onClick={() => onRun(item)}
                                    className={clsx(
                                        'grid grid-cols-[16px_1fr_auto] items-center gap-2.5 px-3.5 py-2 text-[13px] text-fg',
                                        index === selected && 'bg-accent/12',
                                    )}
                                >
                                    <span aria-hidden="true" className="text-center text-[11px] text-muted">
                                        {item.icon}
                                    </span>
                                    <span className="truncate">{item.label}</span>
                                    <span className="font-mono text-[10px] text-muted">{item.hint}</span>
                                </div>
                            </div>
                        );
                    })}
                    {matches.length === 0 && <p className="px-3.5 py-4 text-xs text-muted">{copy.noMatch}</p>}
                </div>
                <div className="flex gap-3 border-t border-hair px-3.5 py-2 font-mono text-[10px] text-muted">
                    <span>↑↓ {copy.hints.move}</span>
                    <span>↵ {copy.hints.run}</span>
                    <span>esc {copy.hints.close}</span>
                    <span>{copy.hints.prefixes}</span>
                </div>
            </div>
        </div>
    );
}
