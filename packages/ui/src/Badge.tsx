import clsx from 'clsx';

type BadgeVariant = 'priority' | 'source' | 'neutral' | 'accent' | 'warn';

type BadgeProps = {
    variant: BadgeVariant;
    children: React.ReactNode;
};

/** Small pill for priority, provenance or status. Priority is always named, never a bare number. */
export function Badge({ variant, children }: BadgeProps): React.JSX.Element {
    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]',
                variant === 'priority' && 'bg-warn-bg text-warn',
                variant === 'source' && 'bg-nav-on-bg text-muted',
                variant === 'neutral' && 'bg-nav-on-bg text-muted',
                variant === 'accent' && 'bg-nav-on-bg text-accent',
                variant === 'warn' && 'bg-warn-bg text-warn',
            )}
        >
            {children}
        </span>
    );
}
