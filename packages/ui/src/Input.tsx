import { type InputHTMLAttributes } from 'react';
import clsx from 'clsx';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
};

/** Text input with an optional label and error message. */
export function Input({ label, error, className, id, ...props }: InputProps): React.JSX.Element {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const errorId = error && inputId ? `${inputId}-error` : undefined;

    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label htmlFor={inputId} className="text-[11px] uppercase tracking-[0.12em] text-muted">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                aria-invalid={error ? true : undefined}
                aria-describedby={errorId}
                className={clsx(
                    'w-full rounded-ctm border border-line bg-panel px-3 py-2 text-sm text-fg',
                    'placeholder:text-muted',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    error && 'border-warn',
                    className,
                )}
                {...props}
            />
            {error && (
                <p id={errorId} className="text-xs text-warn">
                    {error}
                </p>
            )}
        </div>
    );
}
