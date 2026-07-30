type TaskGroupProps = {
    heading: string;
    count: number;
    emptyBody: string;
    children?: React.ReactNode;
};

/** A due-state group: heading, count, and its own empty sentence. */
export function TaskGroup({ heading, count, emptyBody, children }: TaskGroupProps): React.JSX.Element {
    return (
        <section className="flex flex-col gap-1.5">
            <header className="flex items-center gap-2 pt-1 text-[11px] uppercase tracking-[0.1em] text-muted">
                <span>{heading}</span>
                <span className="tabular-nums">{count}</span>
            </header>
            {count === 0
                ? <p className="rounded-ctm border border-line bg-panel px-3 py-3.5 text-xs text-muted">{emptyBody}</p>
                : <div className="overflow-hidden rounded-ctm border border-line bg-panel">{children}</div>}
        </section>
    );
}
