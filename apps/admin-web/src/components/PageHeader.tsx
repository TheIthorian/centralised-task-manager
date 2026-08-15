/** Title, one line of context, and whatever control belongs to the page as a whole. */
export function PageHeader({
    title,
    subtitle,
    action,
}: {
    title: string;
    subtitle: string;
    action?: React.ReactNode;
}): React.JSX.Element {
    return (
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
                <p className="text-xs text-muted">{subtitle}</p>
            </div>
            {action}
        </header>
    );
}
