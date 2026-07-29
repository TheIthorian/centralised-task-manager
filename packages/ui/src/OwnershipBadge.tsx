import clsx from 'clsx';

type Ownership = 'synced' | 'local' | 'read-only';

/**
 * Says who owns a field: synced writes back to the source, local lives only here because the
 * connector has no such concept, read-only cannot be changed from our side. Without this,
 * editing duration on a Google Tasks item looks broken rather than deliberate.
 */
export function OwnershipBadge({ ownership }: { ownership: Ownership }): React.JSX.Element {
    return (
        <span
            className={clsx(
                'rounded-[3px] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em]',
                ownership === 'synced' && 'bg-accent/15 text-accent',
                ownership === 'local' && 'bg-nav-on-bg text-muted',
                ownership === 'read-only' && 'border border-line text-muted',
            )}
        >
            {ownership}
        </span>
    );
}
