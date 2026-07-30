import { useId } from 'react';
import { FIELD_CONTROL_CLASS, FIELD_LABEL_CLASS } from './DetailSection.js';

type DetailSelectProps<T extends string> = {
    label: string;
    value: T;
    options: readonly { value: T; label: string }[];
    onChange: (value: T) => void;
    disabled?: boolean;
};

/** Labelled select in the panel's field style. */
export function DetailSelect<T extends string>({
    label,
    value,
    options,
    onChange,
    disabled = false,
}: DetailSelectProps<T>): React.JSX.Element {
    const id = useId();

    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className={FIELD_LABEL_CLASS}>
                {label}
            </label>
            <select
                id={id}
                value={value}
                disabled={disabled}
                onChange={(event) => {
                    // Matching against the options keeps the handler on the caller's union
                    // without casting the raw string value back to it.
                    const next = options.find((option) => option.value === event.target.value);

                    if (next) onChange(next.value);
                }}
                className={FIELD_CONTROL_CLASS}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
