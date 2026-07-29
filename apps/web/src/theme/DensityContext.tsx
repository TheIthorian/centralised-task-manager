import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { InternalError } from '@ctm/errors';

export type Density = 'compact' | 'comfortable' | 'spacious';

const STORAGE_KEY = 'ctm.density';
const DENSITIES: Density[] = ['compact', 'comfortable', 'spacious'];

type DensityContextValue = {
    density: Density;
    setDensity: (density: Density) => void;
};

const DensityContext = createContext<DensityContextValue | null>(null);

/**
 * Row density is a display preference, so it lives in local storage rather than on the
 * account. An unrecognised stored value falls back to comfortable: bad local state is not a
 * reason to fail a render.
 */
function readStored(): Density {
    const stored = localStorage.getItem(STORAGE_KEY);

    return DENSITIES.find((d) => d === stored) ?? 'comfortable';
}

/** Provides the row density and mirrors it onto the document element as `data-density`. */
export function DensityProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
    const [density, setDensityState] = useState<Density>(readStored);

    useEffect(() => {
        document.documentElement.dataset['density'] = density;
    }, [density]);

    const setDensity = useCallback((next: Density): void => {
        localStorage.setItem(STORAGE_KEY, next);
        setDensityState(next);
    }, []);

    const value = useMemo(() => ({ density, setDensity }), [density, setDensity]);

    return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

/** Reads the current row density. Throws outside the provider, which is a wiring bug. */
export function useDensity(): DensityContextValue {
    const ctx = useContext(DensityContext);

    if (!ctx) throw new InternalError('useDensity must be used within DensityProvider');

    return ctx;
}
