const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const numberFormat = new Intl.NumberFormat();

/** Format an ISO timestamp for display, or return the "never" copy when there is none. */
export function formatDateTime({ iso, never }: { iso: string | null; never: string }): string {
    if (iso === null) return never;

    const parsed = new Date(iso);

    // An unparseable timestamp is data, not a crash: show it verbatim so the operator can see
    // what the server actually sent.
    return Number.isNaN(parsed.getTime()) ? iso : dateTimeFormat.format(parsed);
}

/** Group a count by the reader's locale, so six figures stay readable. */
export function formatCount(value: number): string {
    return numberFormat.format(value);
}

/** Split a textarea's contents into trimmed, non-empty lines. */
export function toLines(value: string): string[] {
    return value
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}
