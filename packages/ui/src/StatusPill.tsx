import clsx from 'clsx';

type StatusPillProps = {
    status: 'ok' | 'warn' | 'neutral';
    children: React.ReactNode;
};

/** Connector health, encoded in form as well as words so it reads at a glance. */
export function StatusPill({ status, children }: StatusPillProps): React.JSX.Element {
    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px]',
                status === 'ok' && 'bg-accent/15 text-accent',
                status === 'warn' && 'bg-warn-bg text-warn',
                status === 'neutral' && 'bg-nav-on-bg text-muted',
            )}
        >
            {children}
        </span>
    );
}
