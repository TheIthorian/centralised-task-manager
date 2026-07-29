import clsx from 'clsx';

type Option<T extends string> = {
    value: T;
    label: string;
};

type SegmentedControlProps<T extends string> = {
    label: string;
    options: Option<T>[];
    value: T;
    onChange: (value: T) => void;
};

/** Single-select strip built on radio inputs, so arrow keys and grouping come for free. */
export function SegmentedControl<T extends string>({
    label,
    options,
    value,
    onChange,
}: SegmentedControlProps<T>): React.JSX.Element {
    return (
        <fieldset role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-ctm border border-line">
            {options.map((option) => (
                <label
                    key={option.value}
                    className={clsx(
                        'cursor-pointer border-r border-line px-3 py-1.5 text-[11px] last:border-r-0',
                        'transition-colors duration-press',
                        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-accent',
                        option.value === value ? 'bg-accent text-accent-fg' : 'bg-panel text-muted hover:text-fg',
                    )}
                >
                    <input
                        type="radio"
                        name={label}
                        value={option.value}
                        checked={option.value === value}
                        onChange={() => onChange(option.value)}
                        className="sr-only"
                    />
                    {option.label}
                </label>
            ))}
        </fieldset>
    );
}
