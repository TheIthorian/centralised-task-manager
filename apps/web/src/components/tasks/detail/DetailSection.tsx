import { OwnershipBadge } from '@ctm/ui';
import type { FieldOwnership } from './field-ownership.js';

/** The label voice of the panel, shared so a field and a section title read the same. */
export const FIELD_LABEL_CLASS = 'text-[11px] uppercase tracking-[0.12em] text-muted';

/** Controls stay at the 44px touch target below the tablet breakpoint, whatever the density is. */
export const FIELD_CONTROL_CLASS = [
    'min-h-11 w-full rounded-ctm border border-line bg-panel px-3 py-2 text-sm text-fg md:min-h-0',
    'placeholder:text-muted',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:cursor-not-allowed disabled:opacity-50',
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
