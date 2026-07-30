import { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';

export type FilterOption = {
    value: string;
    label: string;
    checked: boolean;
};

export type FilterGroup = {
    id: string;
    label: string;
    options: FilterOption[];
};

export type FilterMenuProps = {
    /** The button's text. The count of applied filters is appended for the user and for AT. */
    label: string;
    groups: FilterGroup[];
    onToggle: (selection: { groupId: string; value: string }) => void;
    onClear: () => void;
    clearLabel: string;
    /** When given, the panel footer can name the current selection and save it. */
    onSaveView?: (name: string) => void;
    labels?: { saveView: string; viewName: string; save: string };
};

/**
 * A dropdown of checkbox groups. Filters are chosen together and then applied at once, which
 * a row of pills cannot do: every pill press is its own reflow of the list underneath.
 */
export function FilterMenu({
    label,
    groups,
    onToggle,
    onClear,
    clearLabel,
    onSaveView,
    labels,
}: FilterMenuProps): React.JSX.Element {
    const [open, setOpen] = useState(false);
    const [viewName, setViewName] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const panelId = useId();

    const applied = groups.reduce(
        (total, group) => total + group.options.filter((option) => option.checked).length,
        0,
    );

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent): void => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };

        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') setOpen(false);
        };

        setViewName(null);
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <div ref={containerRef} className="relative inline-block">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((current) => !current)}
                className={clsx(
                    'inline-flex h-11 cursor-pointer items-center gap-2 rounded-ctm border px-3 text-[12.5px] md:h-8',
                    'transition-colors duration-press',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    applied > 0 ? 'border-accent text-fg' : 'border-line text-muted hover:text-fg',
                )}
            >
                {label}
                {applied > 0 && (
                    <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-fg tabular-nums">
                        {applied}
                    </span>
                )}
                <span aria-hidden="true" className="text-[9px] text-muted">
                    ▼
                </span>
            </button>

            {open && (
                <div
                    id={panelId}
                    className={clsx(
                        'absolute left-0 top-full z-40 mt-1.5 w-60 overflow-hidden rounded-ctm border border-line',
                        'bg-panel shadow-overlay',
                        'motion-safe:animate-[ctm-rise_140ms_cubic-bezier(.2,.8,.3,1)]',
                    )}
                >
                    <div className="max-h-[320px] overflow-y-auto p-1.5">
                        {groups.map((group) => (
                            <fieldset key={group.id} className="border-0 p-0">
                                <legend className="px-2 pb-1 pt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted">
                                    {group.label}
                                </legend>
                                {group.options.map((option) => (
                                    // The whole row is the control, so the box and its text
                                    // cannot disagree about what a click does.
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="checkbox"
                                        aria-checked={option.checked}
                                        onClick={() => onToggle({ groupId: group.id, value: option.value })}
                                        className={clsx(
                                            'flex w-full cursor-pointer items-center gap-2.5 rounded-ctm px-2 py-1.5',
                                            'text-left text-[12.5px] text-fg hover:bg-nav-on-bg',
                                            'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
                                        )}
                                    >
                                        <CheckMark checked={option.checked} />
                                        {option.label}
                                    </button>
                                ))}
                            </fieldset>
                        ))}
                    </div>

                    {applied > 0 && (
                        <div className="flex flex-col gap-1 border-t border-hair p-1.5">
                            {viewName === null ? (
                                <div className="flex items-center justify-between gap-2">
                                    <FooterAction label={clearLabel} onClick={onClear} />
                                    {onSaveView && labels && (
                                        <FooterAction label={labels.saveView} onClick={() => setViewName('')} />
                                    )}
                                </div>
                            ) : (
                                // The name is asked for inside the panel, so a growing field
                                // cannot shove the row the trigger sits in.
                                <form
                                    className="flex items-center gap-1.5"
                                    onSubmit={(event) => {
                                        event.preventDefault();

                                        if (!viewName.trim() || !onSaveView) return;

                                        onSaveView(viewName.trim());
                                        setViewName(null);
                                        setOpen(false);
                                    }}
                                >
                                    <input
                                        aria-label={labels?.viewName}
                                        placeholder={labels?.viewName}
                                        value={viewName}
                                        maxLength={40}
                                        autoFocus
                                        onChange={(event) => setViewName(event.target.value)}
                                        className="min-w-0 flex-1 rounded-ctm border border-line bg-bg px-2 py-1.5 text-[12px] text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                                    />
                                    <button
                                        type="submit"
                                        className="cursor-pointer rounded-ctm border border-line px-2.5 py-1.5 text-[12px] text-fg transition-colors duration-press hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                    >
                                        {labels?.save}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/** A quiet text action in the panel footer. */
function FooterAction({ label, onClick }: { label: string; onClick: () => void }): React.JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            className="cursor-pointer rounded-ctm px-2 py-1.5 text-[12px] text-muted transition-colors duration-press hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        >
            {label}
        </button>
    );
}

/** The box itself. Decorative: the row around it carries the role and the state. */
function CheckMark({ checked }: { checked: boolean }): React.JSX.Element {
    return (
        <span
            aria-hidden="true"
            className={clsx(
                'flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px]',
                'transition-colors duration-press',
                checked ? 'border-accent bg-accent text-accent-fg' : 'border-muted bg-panel',
            )}
        >
            {checked && (
                <svg width="10" height="8" viewBox="0 0 12 10" fill="none">
                    <path
                        d="M1 5L4.5 8.5L11 1"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
        </span>
    );
}
