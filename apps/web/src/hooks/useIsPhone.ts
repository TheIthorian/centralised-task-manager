import { useEffect, useState } from 'react';

/** The one breakpoint that matters: below it the app is one column and every target is 44px. */
const PHONE_QUERY = '(max-width: 767px)';

/**
 * True while the viewport is narrower than the `md` breakpoint. Layout that CSS can express
 * belongs in Tailwind; this is for the cases where the component tree itself has to differ.
 */
export function useIsPhone(): boolean {
    const [isPhone, setIsPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);

    useEffect(() => {
        const query = window.matchMedia(PHONE_QUERY);
        const onChange = (event: MediaQueryListEvent): void => setIsPhone(event.matches);

        query.addEventListener('change', onChange);
        setIsPhone(query.matches);

        return () => query.removeEventListener('change', onChange);
    }, []);

    return isPhone;
}
