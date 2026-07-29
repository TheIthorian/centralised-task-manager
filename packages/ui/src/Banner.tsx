import clsx from 'clsx';

type BannerProps = {
    tone: 'warn' | 'info';
    title: string;
    body: string;
    action?: React.ReactNode;
};

/**
 * Inline notice above the affected list. System failures use this rather than a toast,
 * because a toast disappears before it can be acted on.
 */
export function Banner({ tone, title, body, action }: BannerProps): React.JSX.Element {
    return (
        <div
            role="status"
            className={clsx(
                'flex flex-col gap-1 rounded-ctm border px-3.5 py-3',
                tone === 'warn' ? 'border-warn bg-warn-bg' : 'border-line bg-panel',
            )}
        >
            <strong className={clsx('text-[13px]', tone === 'warn' ? 'text-warn' : 'text-fg')}>{title}</strong>
            <span className="text-xs text-fg">{body}</span>
            {action}
        </div>
    );
}
