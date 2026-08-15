import '@testing-library/jest-dom';
import { initI18n } from './i18n/index.js';

// Tests query by visible text, so they need the real catalogue rather than key paths.
await initI18n();

// jsdom has no matchMedia. The proxy suite runs in the node environment, where there is no
// window at all.
if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = (query: string): MediaQueryList =>
        ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: (): void => {},
            removeEventListener: (): void => {},
            addListener: (): void => {},
            removeListener: (): void => {},
            dispatchEvent: (): boolean => false,
        }) as MediaQueryList;
}
