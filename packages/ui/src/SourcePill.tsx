import { BrandIcon } from './BrandIcon.js';
import type { BrandKey } from './brand-icons.js';

type SourcePillProps = {
    /** Omitted for tasks that live only here, which have no third party to badge. */
    brand?: BrandKey;
    label: string;
    /** Drops the words and keeps the mark, for rows too narrow to spend width on the name. */
    iconOnly?: boolean;
};

/** Where a task came from. The mark carries the identity, so provenance reads before the words. */
export function SourcePill({ brand, label, iconOnly = false }: SourcePillProps): React.JSX.Element {
    if (iconOnly) {
        return (
            <span
                role="img"
                aria-label={label}
                className="inline-flex items-center justify-center rounded-[4px] bg-nav-on-bg p-1"
            >
                {brand ? <BrandIcon brand={brand} size={12} /> : <span className="text-[10px] text-muted">{label}</span>}
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-nav-on-bg px-2 py-0.5 text-[10px] text-muted">
            {brand && <BrandIcon brand={brand} size={11} />}
            {label}
        </span>
    );
}
