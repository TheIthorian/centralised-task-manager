import clsx from 'clsx';

type CheckboxProps = {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
};

/** Square checkbox. Accent fill when checked, hairline border when not. */
export function Checkbox({ checked, onChange, label, disabled }: CheckboxProps): React.JSX.Element {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={clsx(
                'relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px]',
                'cursor-pointer motion-safe:transition-[color,background-color,border-color,transform] duration-press',
                !disabled && 'motion-safe:active:scale-90',
                // The box stays 18px because a 44px square would dominate the row. The hit
                // area is grown instead, so a thumb has the full target the box does not show.
                'before:absolute before:-inset-[13px] before:content-[""] md:before:hidden',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                checked ? 'border-accent bg-accent' : 'border-muted bg-panel',
                disabled && 'cursor-not-allowed opacity-50',
            )}
        >
            {checked && (
                <svg
                    width="12"
                    height="10"
                    viewBox="0 0 12 10"
                    fill="none"
                    aria-hidden="true"
                    className="text-accent-fg motion-safe:animate-[ctm-pop_var(--duration-surface)_var(--ease-surface)]"
                >
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
