type SourceMeta = {
    label: string;
    favicon: string;
};

const SOURCES: Record<string, SourceMeta> = {
    todoist: { label: 'Todoist', favicon: '/favicons/todoist.png' },
    google_tasks: { label: 'Google Tasks', favicon: '/favicons/google_tasks.png' },
    notion: { label: 'Notion', favicon: '/favicons/notion.png' },
};

/** Get a human-readable label for a connector source. */
export function getSourceLabel(source: string | null | undefined): string {
    if (!source) return 'Unknown';
    return SOURCES[source]?.label ?? source.toUpperCase();
}

/** Get a favicon URL for a connector source, or null if unknown. */
export function getSourceFaviconUrl(source: string | null | undefined): string | null {
    if (!source) return null;
    return SOURCES[source]?.favicon ?? null;
}
