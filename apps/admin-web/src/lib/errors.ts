/**
 * Browser-side typed errors.
 *
 * `@ctm/errors` builds to CommonJS for the Node apps, and Vite cannot resolve its named
 * exports from browser code, so this app declares the few errors it needs here rather than
 * throwing bare `Error`.
 */

/** Thrown when a hook is used outside the provider that supplies its context. */
export class MissingProviderError extends Error {
    constructor({ hook, provider }: { hook: string; provider: string }) {
        super(`${hook} must be used within ${provider}`);
        this.name = 'MissingProviderError';
    }
}

/** Thrown when the document has no mount point, which means index.html was tampered with. */
export class MissingRootElementError extends Error {
    constructor() {
        super('Root element not found');
        this.name = 'MissingRootElementError';
    }
}
