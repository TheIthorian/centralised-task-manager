import { useEffect, useRef, useState } from 'react';

export type Presence = {
    /** Whether the surface should be in the tree at all. */
    mounted: boolean;
    /** True while the surface is on its way out and should run its exit animation. */
    leaving: boolean;
};

/**
 * Keeps a surface mounted for the length of its exit animation after `open` goes false, so a
 * panel can animate closed instead of vanishing. Under `prefers-reduced-motion` the surface
 * unmounts immediately, which is what a user asking for less motion wants from a dismissal.
 */
export function usePresence({ open, exitDurationMs }: { open: boolean; exitDurationMs: number }): Presence {
    const [mounted, setMounted] = useState(open);
    const [leaving, setLeaving] = useState(false);

    // Read inside the effect without making it a dependency: depending on `mounted` restarts
    // the exit timer the moment it fires and sets `mounted` false.
    const mountedRef = useRef(open);
    mountedRef.current = mounted;

    useEffect(() => {
        if (open) {
            setMounted(true);
            setLeaving(false);
            return;
        }

        if (!mountedRef.current) return;

        if (prefersReducedMotion()) {
            setMounted(false);
            setLeaving(false);
            return;
        }

        setLeaving(true);

        const timeout = window.setTimeout(() => {
            setMounted(false);
            setLeaving(false);
        }, exitDurationMs);

        return () => window.clearTimeout(timeout);
    }, [open, exitDurationMs]);

    return { mounted, leaving };
}

/** Reads the motion preference at call time, since a user can change it while the app is open. */
function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
