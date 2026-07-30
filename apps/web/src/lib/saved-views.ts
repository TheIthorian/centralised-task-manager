/** A named set of filter conditions, stored as the query string that produces it. */
export type SavedView = {
    id: string;
    name: string;
    search: string;
};

const STORAGE_KEY = 'ctm.views';
const MAX_NAME_LENGTH = 40;

/**
 * Views are a display preference, so they live in local storage rather than on the account.
 * They are stored as a query string because that is exactly what restoring one has to do,
 * and it survives a change to the condition model without a migration.
 */
export function readSavedViews(): SavedView[] {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    try {
        const parsed: unknown = JSON.parse(raw);

        return Array.isArray(parsed) ? parsed.filter(isSavedView) : [];
    } catch {
        // Bad local state is not a reason to fail the page.
        return [];
    }
}

/** Appends a view and returns the new list. */
export function addSavedView({ name, search }: { name: string; search: string }): SavedView[] {
    const view: SavedView = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim().slice(0, MAX_NAME_LENGTH),
        search,
    };
    const next = [...readSavedViews(), view];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    return next;
}

/** Removes a view by id and returns the new list. */
export function removeSavedView(id: string): SavedView[] {
    const next = readSavedViews().filter((view) => view.id !== id);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    return next;
}

function isSavedView(value: unknown): value is SavedView {
    if (typeof value !== 'object' || value === null) return false;

    const candidate = value as Record<string, unknown>;

    return (
        typeof candidate['id'] === 'string' &&
        typeof candidate['name'] === 'string' &&
        typeof candidate['search'] === 'string'
    );
}
