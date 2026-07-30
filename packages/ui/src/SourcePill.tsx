import { BrandIcon } from './BrandIcon.js';
import type { BrandKey } from './brand-icons.js';

type SourcePillProps = {
    brand: BrandKey;
    label: string;
};

/** Where a task came from. The mark carries the identity, so provenance reads before the words. */
export function SourcePill({ brand, label }: SourcePillProps): React.JSX.Element {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-nav-on-bg px-2 py-0.5 text-[10px] text-muted">
            <BrandIcon brand={brand} size={11} />
            {label}
        </span>
    );
}
