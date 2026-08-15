import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePresence } from './usePresence.js';

/** jsdom has no matchMedia, and the hook branches on the motion preference. */
function stubMotionPreference(reduce: boolean): void {
    window.matchMedia = vi.fn().mockReturnValue({ matches: reduce });
}

describe('usePresence', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        stubMotionPreference(false);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('mounts immediately when opened', () => {
        const { result, rerender } = renderHook(({ open }) => usePresence({ open, exitDurationMs: 240 }), {
            initialProps: { open: false },
        });

        expect(result.current.mounted).toBe(false);

        rerender({ open: true });

        expect(result.current).toEqual({ mounted: true, leaving: false });
    });

    it('stays mounted and marked leaving until the exit duration elapses', () => {
        const { result, rerender } = renderHook(({ open }) => usePresence({ open, exitDurationMs: 240 }), {
            initialProps: { open: true },
        });

        rerender({ open: false });

        expect(result.current).toEqual({ mounted: true, leaving: true });

        act(() => {
            vi.advanceTimersByTime(240);
        });

        expect(result.current).toEqual({ mounted: false, leaving: false });
    });

    it('cancels the exit when reopened mid-animation', () => {
        const { result, rerender } = renderHook(({ open }) => usePresence({ open, exitDurationMs: 240 }), {
            initialProps: { open: true },
        });

        rerender({ open: false });

        act(() => {
            vi.advanceTimersByTime(100);
        });

        rerender({ open: true });

        act(() => {
            vi.advanceTimersByTime(240);
        });

        expect(result.current).toEqual({ mounted: true, leaving: false });
    });

    it('unmounts without an exit phase under prefers-reduced-motion', () => {
        stubMotionPreference(true);

        const { result, rerender } = renderHook(({ open }) => usePresence({ open, exitDurationMs: 240 }), {
            initialProps: { open: true },
        });

        rerender({ open: false });

        expect(result.current).toEqual({ mounted: false, leaving: false });
    });
});
