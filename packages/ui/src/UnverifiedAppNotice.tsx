type UnverifiedAppNoticeProps = {
    title: string;
    body: string;
    /** Labels the redirect host list. Rendered only when there is at least one host. */
    hostsLabel: string;
    hosts: string[];
};

/**
 * Warns that an app registered itself and its name is its own claim rather than a fact.
 *
 * The warning is carried by the glyph and the wording as well as the tone, so it survives for a
 * user who cannot separate the warn colour from the panel background. It arrives after an async
 * lookup, hence the status role.
 */
export function UnverifiedAppNotice({ title, body, hostsLabel, hosts }: UnverifiedAppNoticeProps): React.JSX.Element {
    return (
        <div role="status" className="flex gap-2.5 rounded-ctm border border-warn bg-warn-bg px-3.5 py-3">
            <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="mt-0.5 h-4 w-4 flex-shrink-0 fill-current text-warn"
            >
                <path d="M8 1.5 15 14.5H1L8 1.5Zm0 4a.75.75 0 0 0-.75.75v3.25a.75.75 0 0 0 1.5 0V6.25A.75.75 0 0 0 8 5.5Zm0 6a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z" />
            </svg>

            <div className="flex flex-col gap-1">
                <strong className="text-[13px] text-warn">{title}</strong>
                <span className="text-xs text-fg">{body}</span>

                {hosts.length > 0 && (
                    <span className="text-xs text-muted">
                        {hostsLabel}{' '}
                        {hosts.map((host, index) => (
                            <span key={host}>
                                {index > 0 && ', '}
                                <span className="font-mono text-fg">{host}</span>
                            </span>
                        ))}
                    </span>
                )}
            </div>
        </div>
    );
}
