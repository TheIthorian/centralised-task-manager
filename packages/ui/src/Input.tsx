import { type InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

/** Neobrutalist text input with optional label and error message. */
export function Input({ label, error, className, id, ...props }: InputProps): React.JSX.Element {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
        <div className="flex flex-col gap-1">
            {label && (
                <label htmlFor={inputId} className="font-black uppercase text-xs tracking-wide text-nb-black dark:text-white">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={clsx(
                    'w-full border-2 border-nb-black dark:border-white/20 bg-white dark:bg-neutral-800 font-bold p-2 text-nb-black dark:text-white',
                    'focus:outline-none focus:shadow-[3px_3px_0px_#111] dark:focus:shadow-none',
                    'placeholder:text-nb-grey placeholder:font-bold',
                    error && 'border-nb-red',
                    className,
                )}
                {...props}
            />
            {error && <p className="text-nb-red font-bold text-xs">{error}</p>}
        </div>
    );
}
