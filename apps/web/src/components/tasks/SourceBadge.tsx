import { Badge, BrandIcon } from '@ctm/ui';
import { getSourceLabel, getSourceBrand } from '../../lib/source-labels.js';

type SourceBadgeProps = {
    source: string | null | undefined;
};

/** Renders a source badge with the brand mark for external sources; returns null for local tasks. */
export function SourceBadge({ source }: SourceBadgeProps): React.JSX.Element | null {
    if (!source || source === 'local') return null;

    const label = getSourceLabel(source);
    const brand = getSourceBrand(source);

    return (
        <Badge variant="source">
            <span className="inline-flex items-center gap-1.5">
                {brand && <BrandIcon brand={brand} size={12} />}
                {label}
            </span>
        </Badge>
    );
}
