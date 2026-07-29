import { type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
};

/** Quiet Slate button: one accent, a hairline border, and no offset shadow. */
export function Button({ variant = 'primary', className, children, ...props }: ButtonProps): React.JSX.Element {
    return (
        <button
            className={clsx(
                'inline-flex items-center justify-center gap-2 rounded-ctm',
                'border px-3.5 py-1.5 text-sm font-semibold',
                'cursor-pointer transition-colors duration-press',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                'disabled:cursor-not-allowed disabled:opacity-50',
                variant === 'primary' && 'border-transparent bg-accent text-accent-fg hover:opacity-90',
                variant === 'secondary' && 'border-line bg-panel text-fg hover:bg-nav-on-bg',
                variant === 'ghost' && 'border-transparent bg-transparent text-muted hover:text-fg',
                variant === 'danger' && 'border-transparent bg-warn text-accent-fg hover:opacity-90',
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}
