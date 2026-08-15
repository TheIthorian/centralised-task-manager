import clsx from 'clsx';

/**
 * One figure with its name. `tone="warn"` is reserved for counts that mean something is
 * wrong, and is paired with a word rather than carried by the colour alone.
 */
export function StatCard({
    label,
    value,
    hint,
    tone = 'neutral',
}: {
    label: string;
    value: string;
    hint?: string;
    tone?: 'neutral' | 'warn';
}): React.JSX.Element {
    return (
        <div className="flex flex-col gap-1 rounded-ctm border border-line bg-panel px-4 py-3">
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</span>
            <span
                aria-live="polite"
                className={clsx('text-2xl font-semibold tabular-nums', tone === 'warn' ? 'text-warn' : 'text-fg')}
            >
                {value}
            </span>
            {hint && <span className="text-[11px] text-muted">{hint}</span>}
        </div>
    );
}
