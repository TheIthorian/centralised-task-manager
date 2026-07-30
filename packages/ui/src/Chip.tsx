import clsx from 'clsx';

type ChipProps = {
    label: string;
    selected?: boolean;
    onToggle?: () => void;
    icon?: React.ReactNode;
    /**
     * How a selected chip is drawn. Accent is for the one slice you are looking at; subtle
     * is for something you applied on top of it, so the two states do not look identical.
     */
    tone?: 'accent' | 'subtle';
    /** When given, the chip carries its own remove control. */
    onRemove?: () => void;
    removeLabel?: string;
};

/** Filter or range toggle. Renders as static text when no handler is given. */
export function Chip({
    label,
    selected = false,
    onToggle,
    icon,
    tone = 'accent',
    onRemove,
    removeLabel,
}: ChipProps): React.JSX.Element {
    const shape = clsx(
        'inline-flex h-11 items-center gap-1.5 rounded-ctm border px-2.5 text-[11px] md:h-8',
        'transition-colors duration-press',
        !selected && 'border-line bg-panel text-muted',
        selected && tone === 'accent' && 'border-accent bg-accent text-accent-fg',
        // A left edge as well as the border, so applied is not carried by colour alone.
        selected && tone === 'subtle' && 'border-accent border-l-[3px] bg-nav-on-bg text-fg',
    );
    const mark = icon ? <span aria-hidden="true">{icon}</span> : null;
    const interactive = 'cursor-pointer hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

    if (!onToggle) {
        return (
            <span className={shape}>
                {mark}
                {label}
            </span>
        );
    }

    if (!onRemove) {
        return (
            <button type="button" aria-pressed={selected} onClick={onToggle} className={clsx(shape, interactive)}>
                {mark}
                {label}
            </button>
        );
    }

    // Two controls share one outline rather than nesting, which is not valid and loses the
    // remove button to a screen reader.
    return (
        <span className={clsx(shape, 'gap-0 p-0')}>
            <button
                type="button"
                aria-pressed={selected}
                onClick={onToggle}
                className={clsx('inline-flex h-full items-center gap-1.5 rounded-l-ctm pl-2.5 pr-2', interactive)}
            >
                {mark}
                {label}
            </button>
            <button
                type="button"
                onClick={onRemove}
                aria-label={removeLabel}
                className={clsx('inline-flex h-full items-center rounded-r-ctm border-l border-current/25 px-2', interactive)}
            >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                    <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </button>
        </span>
    );
}
