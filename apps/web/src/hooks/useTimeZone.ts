import { useMemo } from 'react';
import { browserTimeZone } from '../lib/timezone.js';

/**
 * The zone this screen renders in.
 *
 * The browser's zone rather than the one stored on the profile: a traveller's screen should follow
 * them the moment they land, and the stored value exists so the server can decide day boundaries
 * when no browser is present. `AuthContext` pushes the browser's zone up when the two disagree.
 */
export function useTimeZone(): string {
    return useMemo(() => browserTimeZone(), []);
}
