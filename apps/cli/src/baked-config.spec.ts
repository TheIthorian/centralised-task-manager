import { describe, it, expect, afterEach } from 'vitest';
import { bakedBaseUrl } from './baked-config.js';

const GLOBAL_KEY = '__CTM_DEFAULT_BASE_URL__';

function setBakedValue(value: string | undefined): void {
    const target = globalThis as unknown as Record<string, string | undefined>;

    if (value === undefined) {
        delete target[GLOBAL_KEY];
        return;
    }

    target[GLOBAL_KEY] = value;
}

afterEach(() => {
    setBakedValue(undefined);
});

describe('bakedBaseUrl', () => {
    it('returns null when the CLI was built without a baked URL', () => {
        expect(bakedBaseUrl()).toBeNull();
    });

    it('returns null when the baked URL is an empty string', () => {
        setBakedValue('');

        expect(bakedBaseUrl()).toBeNull();
    });

    it('returns the baked URL when one was defined at bundle time', () => {
        setBakedValue('https://api.example.com');

        expect(bakedBaseUrl()).toBe('https://api.example.com');
    });
});
