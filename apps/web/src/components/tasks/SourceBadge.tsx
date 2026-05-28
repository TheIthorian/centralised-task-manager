import { Badge } from '@ctm/ui';
import { getSourceLabel, getSourceFaviconUrl } from '../../lib/source-labels.js';

type SourceBadgeProps = {
    source: string | null | undefined;
};

/** Renders a source badge with favicon logo for external sources; returns null for local tasks. */
export function SourceBadge({ source }: SourceBadgeProps): React.JSX.Element | null {
    if (!source || source === 'local') return null;

    const label = getSourceLabel(source);
    const favicon = getSourceFaviconUrl(source);

    return (
        <Badge variant="source">
            <span className="inline-flex items-center gap-1">
                {favicon && <img src={favicon} alt="" width={12} height={12} className="inline-block" />}
                {label}
            </span>
        </Badge>
    );
}
