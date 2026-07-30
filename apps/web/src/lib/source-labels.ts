import type { BrandKey } from '@ctm/ui';

type SourceMeta = {
    label: string;
    brand: BrandKey;
};

const SOURCES: Record<string, SourceMeta> = {
    todoist: { label: 'Todoist', brand: 'todoist' },
    google_tasks: { label: 'Google Tasks', brand: 'google_tasks' },
    notion: { label: 'Notion', brand: 'notion' },
    discord: { label: 'Discord', brand: 'discord' },
};

/** Get a human-readable label for a connector source. */
export function getSourceLabel(source: string | null | undefined): string {
    if (!source) return 'Unknown';
    return SOURCES[source]?.label ?? source.toUpperCase();
}

/** Get the brand mark for a connector source, or null if unknown. */
export function getSourceBrand(source: string | null | undefined): BrandKey | null {
    if (!source) return null;
    return SOURCES[source]?.brand ?? null;
}
