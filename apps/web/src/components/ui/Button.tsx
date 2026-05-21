import { type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
}

/** Neobrutalist button. Shifts on hover to simulate a press. */
export function Button({ variant = 'primary', className, children, ...props }: ButtonProps): React.JSX.Element {
    return (
        <button
            className={clsx(
                'inline-flex items-center justify-center gap-2',
                'border-2 border-nb-black dark:border-white/20 font-black uppercase tracking-wide text-sm px-4 py-2',
                'transition-all duration-100 cursor-pointer',
                'hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none',
                'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0',
                variant === 'primary' && 'bg-nb-black dark:bg-nb-yellow text-white dark:text-nb-black shadow-[3px_3px_0px_#111] dark:shadow-none',
                variant === 'secondary' && 'bg-white dark:bg-neutral-800 text-nb-black dark:text-white shadow-[3px_3px_0px_#111] dark:shadow-none',
                variant === 'danger' && 'bg-nb-red text-white shadow-[3px_3px_0px_#111]',
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}
