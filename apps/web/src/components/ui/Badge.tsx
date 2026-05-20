import clsx from 'clsx';

type BadgeVariant = 'p1' | 'p2' | 'p3' | 'source';

interface BadgeProps {
    variant: BadgeVariant;
    children: React.ReactNode;
}

/** Small neobrutalist badge for priority or source labels. */
export function Badge({ variant, children }: BadgeProps): React.JSX.Element {
    return (
        <span
            className={clsx(
                'inline-block border-2 border-nb-black text-xs font-black uppercase tracking-wide px-1.5 py-0.5',
                variant === 'p1' && 'bg-nb-red text-white',
                variant === 'p2' && 'bg-nb-yellow text-nb-black',
                variant === 'p3' && 'bg-nb-green text-nb-black',
                variant === 'source' && 'bg-white text-nb-black',
            )}
        >
            {children}
        </span>
    );
}
