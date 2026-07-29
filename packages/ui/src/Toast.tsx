type ToastProps = {
    message: string;
    actionLabel?: string;
    onAction?: () => void;
};

/** Confirms something the user did, with an optional undo. Never used for system failures. */
export function Toast({ message, actionLabel, onAction }: ToastProps): React.JSX.Element {
    return (
        <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-4 rounded-ctm border border-line bg-panel px-3.5 py-2.5 text-[13px] text-fg shadow-overlay"
        >
            <span>{message}</span>
            {actionLabel && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="cursor-pointer text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
