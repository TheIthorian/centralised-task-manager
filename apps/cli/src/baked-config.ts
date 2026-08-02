/**
 * Replaced by esbuild `--define` when the CLI is bundled for release. It is never declared at
 * runtime, so unbundled `tsc` builds and tests leave it undefined.
 */
declare const __CTM_DEFAULT_BASE_URL__: string | undefined;

/**
 * API base URL baked in at bundle time, or null when the CLI was built without one.
 * Ranks below the stored config so a user who logged into a specific server keeps it.
 */
export function bakedBaseUrl(): string | null {
    // `typeof` is the only safe read of an identifier that may not be declared at all.
    if (typeof __CTM_DEFAULT_BASE_URL__ !== 'string') return null;

    return __CTM_DEFAULT_BASE_URL__.length > 0 ? __CTM_DEFAULT_BASE_URL__ : null;
}
