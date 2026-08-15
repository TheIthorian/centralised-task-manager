type ToastProps = {
    /** Optional eyebrow, for toasts that need a category as well as a sentence. */
    title?: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
};

/** Confirms something the user did, with an optional undo. Never used for system failures. */
export function Toast({ title, message, actionLabel, onAction }: ToastProps): React.JSX.Element {
    return (
        <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-4 rounded-ctm border border-line bg-panel px-3.5 py-2.5 text-[13px] text-fg shadow-overlay motion-safe:animate-[ctm-rise_var(--duration-surface)_var(--ease-surface)]"
        >
            <span className="flex min-w-0 flex-col gap-0.5">
                {title && <span className="text-[10px] uppercase tracking-[0.12em] text-muted">{title}</span>}
                <span>{message}</span>
            </span>
            {actionLabel && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="ml-auto shrink-0 cursor-pointer text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
