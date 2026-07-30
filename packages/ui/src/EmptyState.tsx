type EmptyStateProps = {
    title: string;
    body: string;
    action?: React.ReactNode;
};

/** Empty copy is written per filter, never shared, so both lines are always passed in. */
export function EmptyState({ title, body, action }: EmptyStateProps): React.JSX.Element {
    return (
        <div className="flex flex-col items-start gap-1.5 rounded-ctm border border-line bg-panel px-4 py-5">
            <strong className="text-sm text-fg">{title}</strong>
            <span className="text-xs text-muted">{body}</span>
            {action}
        </div>
    );
}
