/**
 * A tab that was open across a deploy still holds the previous `index.html`, whose route chunks
 * no longer exist on the origin. Navigating then fails on the dynamic import rather than on
 * anything the user did, and a reload fetches the current build.
 */

const RETRY_KEY = 'ctm.staleDeploymentReloadAt';

/** How long a reload is assumed to have fixed things, so a genuine failure cannot loop. */
const RETRY_COOLDOWN_MS = 30_000;

/**
 * Whether an error is the browser refusing a route chunk that is no longer served.
 * Each engine words it differently, so all three are matched.
 */
export function isChunkLoadError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();

    return (
        message.includes('dynamically imported module') ||
        message.includes('importing a module script failed') ||
        message.includes('failed to fetch dynamically imported module')
    );
}

/**
 * Reload once to pick up the current build, unless a reload was already tried recently.
 * Returns whether the reload was started.
 */
export function reloadForStaleDeployment(): boolean {
    const lastAttempt = Number(sessionStorage.getItem(RETRY_KEY) ?? 0);

    if (Date.now() - lastAttempt < RETRY_COOLDOWN_MS) return false;

    sessionStorage.setItem(RETRY_KEY, String(Date.now()));
    window.location.reload();

    return true;
}
