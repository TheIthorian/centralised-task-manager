import clsx from 'clsx';

type ChipProps = {
    label: string;
    selected?: boolean;
    onToggle?: () => void;
    icon?: React.ReactNode;
};

/** Pill-shaped filter or range toggle. Renders as static text when no handler is given. */
export function Chip({ label, selected = false, onToggle, icon }: ChipProps): React.JSX.Element {
    const shape = clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]',
        'transition-colors duration-press',
        selected ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-panel text-muted',
    );
    const mark = icon ? <span aria-hidden="true">{icon}</span> : null;

    if (!onToggle) {
        return (
            <span className={shape}>
                {mark}
                {label}
            </span>
        );
    }

    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onToggle}
            className={clsx(
                shape,
                'cursor-pointer hover:border-accent',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            )}
        >
            {mark}
            {label}
        </button>
    );
}
