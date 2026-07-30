import { OwnershipBadge } from '@ctm/ui';
import type { FieldOwnership } from './field-ownership.js';

/** The label voice of the panel, shared so a field and a section title read the same. */
export const FIELD_LABEL_CLASS = 'text-[11px] uppercase tracking-[0.12em] text-muted';

/** One height for every control in the panel, so a field and the button beside it line up. */
export const FIELD_HEIGHT_CLASS = 'h-11 md:h-9';

export const FIELD_CONTROL_CLASS = [
    FIELD_HEIGHT_CLASS,
    'w-full rounded-ctm border border-line bg-panel px-3 text-sm text-fg',
    'placeholder:text-muted',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

/**
 * The browser draws the calendar button itself. Left alone it is a hard black glyph that
 * ignores the theme, so it is tinted to the muted token and lit on hover like any other control.
 */
export const DATE_FIELD_CLASS = [
    FIELD_HEIGHT_CLASS,
    '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
    '[&::-webkit-calendar-picker-indicator]:opacity-55',
    'hover:[&::-webkit-calendar-picker-indicator]:opacity-100',
].join(' ');

type DetailSectionProps = {
    title: string;
    ownership: FieldOwnership;
    children: React.ReactNode;
};

/** A titled group of related fields, carrying the ownership of everything inside it. */
export function DetailSection({ title, ownership, children }: DetailSectionProps): React.JSX.Element {
    return (
        <section className="flex flex-col gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
            <div className="flex items-center gap-2">
                <h3 className={FIELD_LABEL_CLASS}>{title}</h3>
                <OwnershipBadge ownership={ownership} />
            </div>
            {children}
        </section>
    );
}
