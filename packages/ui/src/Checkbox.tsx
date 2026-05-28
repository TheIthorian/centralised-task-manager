import clsx from 'clsx';

type CheckboxProps = {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
};

/** Square neobrutalist checkbox. */
export function Checkbox({ checked, onChange, label, disabled }: CheckboxProps): React.JSX.Element {
    return (
        <button
            role="checkbox"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={clsx(
                'w-5 h-5 border-2 border-nb-black dark:border-white/30 flex-shrink-0',
                'flex items-center justify-center',
                'transition-colors duration-100 cursor-pointer',
                checked ? 'bg-nb-black dark:bg-white' : 'bg-white dark:bg-neutral-800',
                disabled && 'opacity-50 cursor-not-allowed',
            )}
        >
            {checked && (
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none" className="text-white dark:text-nb-black">
                    <path
                        d="M1 5L4.5 8.5L11 1"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
        </button>
    );
}
