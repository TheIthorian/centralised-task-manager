import clsx from 'clsx';
import { Badge } from './Badge.js';
import { Checkbox } from './Checkbox.js';
import { SourcePill } from './SourcePill.js';
import type { BrandKey } from './brand-icons.js';

type TaskRowProps = {
    title: string;
    source: { brand: BrandKey; label: string };
    due?: { label: string; overdue?: boolean };
    priorityLabel?: string;
    completed: boolean;
    /** A write is in flight. The row dims and holds still; it never guesses the outcome. */
    pending?: boolean;
    onToggle: (completed: boolean) => void;
    onOpen?: () => void;
};

/** One task in a list. Presentational: it knows nothing about the API or the query cache. */
export function TaskRow({
    title,
    source,
    due,
    priorityLabel,
    completed,
    pending = false,
    onToggle,
    onOpen,
}: TaskRowProps): React.JSX.Element {
    return (
        <div
            className={clsx(
                'grid grid-cols-[18px_1fr_auto] items-center gap-3 border-b border-hair px-3 last:border-b-0',
                'py-[var(--ctm-row-y)] transition-opacity duration-press',
                pending && 'opacity-55',
            )}
        >
            <Checkbox checked={completed} onChange={onToggle} label={title} disabled={pending} />
            <button
                type="button"
                onClick={onOpen}
                disabled={!onOpen}
                className={clsx(
                    'truncate text-left text-[13.5px] text-fg',
                    onOpen && 'cursor-pointer hover:underline',
                    completed && 'line-through text-muted',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                )}
            >
                {title}
            </button>
            <span className="flex items-center gap-2 whitespace-nowrap text-[11px] tabular-nums">
                {priorityLabel && <Badge variant="priority">{priorityLabel}</Badge>}
                <SourcePill brand={source.brand} label={source.label} />
                {due && (
                    <span className={clsx(due.overdue ? 'rounded-[4px] bg-warn-bg px-2 py-0.5 text-warn' : 'text-muted')}>
                        {due.label}
                    </span>
                )}
            </span>
        </div>
    );
}
