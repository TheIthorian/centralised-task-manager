import { useLayoutEffect, useRef } from 'react';
import { FIELD_CONTROL_CLASS } from './DetailSection.js';

export type AutoGrowTextareaProps = {
    id: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
};

/**
 * A textarea three rows tall to begin with, growing as it is typed into, so notes are never
 * read through a two line slot. The drag handle stays live: a field pulled taller keeps that
 * height as its floor and still grows past it.
 */
export function AutoGrowTextarea({
    id,
    value,
    onChange,
    disabled = false,
    placeholder,
}: AutoGrowTextareaProps): React.JSX.Element {
    const ref = useRef<HTMLTextAreaElement>(null);
    const draggedHeight = useRef<number | null>(null);

    useLayoutEffect(() => {
        const field = ref.current;

        if (!field) return;

        // scrollHeight only reports the content once the element is no longer tall enough to
        // hold it, so the height comes off before it is read and goes straight back on.
        field.style.height = 'auto';
        field.style.height = `${Math.max(field.scrollHeight, draggedHeight.current ?? 0)}px`;
    }, [value]);

    return (
        <textarea
            ref={ref}
            id={id}
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            onMouseUp={(event) => {
                draggedHeight.current = event.currentTarget.clientHeight;
            }}
            className={`${FIELD_CONTROL_CLASS} h-auto min-h-[8.25rem] resize-y py-2 md:min-h-[6.75rem]`}
        />
    );
}
