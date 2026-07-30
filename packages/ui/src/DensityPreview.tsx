type DensityPreviewProps = {
    rows: { title: string; meta: string }[];
};

/**
 * Three sample rows at the current density: the choice is easier to see than to read about.
 * Hidden from assistive technology because it is a sample, not content.
 */
export function DensityPreview({ rows }: DensityPreviewProps): React.JSX.Element {
    return (
        <div aria-hidden="true" className="overflow-hidden rounded-ctm border border-line bg-panel">
            {rows.map((row) => (
                <div
                    key={row.title}
                    className="flex items-center justify-between gap-3 border-b border-hair px-3 py-[var(--ctm-row-y)] text-[13px] text-fg last:border-b-0"
                >
                    <span className="truncate">{row.title}</span>
                    <span className="text-[11px] tabular-nums text-muted">{row.meta}</span>
                </div>
            ))}
        </div>
    );
}
