import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, reloadForStaleDeployment } from './stale-deployment.js';

describe('isChunkLoadError', () => {
    it.each([
        'Failed to fetch dynamically imported module: https://app.example/assets/TasksPage-abc.js',
        'error loading dynamically imported module',
        'Importing a module script failed.',
    ])('recognises %s', (message) => {
        expect(isChunkLoadError(new Error(message))).toBe(true);
    });

    it('ignores an unrelated error', () => {
        expect(isChunkLoadError(new Error('Request failed with status 500'))).toBe(false);
    });

    it('ignores a value that is not an error', () => {
        expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
    });
});

describe('reloadForStaleDeployment', () => {
    const reload = vi.fn();

    beforeEach(() => {
        reload.mockClear();
        sessionStorage.clear();
        Object.defineProperty(window, 'location', { value: { reload }, writable: true });
    });

    it('reloads the page', () => {
        expect(reloadForStaleDeployment()).toBe(true);
        expect(reload).toHaveBeenCalledOnce();
    });

    it('does not reload twice in a row, so a genuine failure cannot loop', () => {
        reloadForStaleDeployment();

        expect(reloadForStaleDeployment()).toBe(false);
        expect(reload).toHaveBeenCalledOnce();
    });

    it('reloads again once the cooldown has passed', () => {
        vi.useFakeTimers();

        try {
            reloadForStaleDeployment();
            vi.advanceTimersByTime(30_001);

            expect(reloadForStaleDeployment()).toBe(true);
            expect(reload).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });
});
