const SOURCE_LABELS: Record<string, string> = {
    todoist: 'Todoist',
    google_tasks: 'Google Tasks',
    notion: 'Notion',
};

/** Get a human-readable label for a connector source. */
export function getSourceLabel(source: string | null | undefined): string {
    if (!source) return 'Unknown';
    return SOURCE_LABELS[source] ?? source.toUpperCase();
}
