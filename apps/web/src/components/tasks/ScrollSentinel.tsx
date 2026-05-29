import { useEffect, useRef } from 'react';

type ScrollSentinelProps = {
    onVisible: () => void;
    disabled?: boolean;
    loadingMessage?: string;
    isLoading?: boolean;
};

/** Fires `onVisible` once when the element scrolls into view. Re-arms on each render. */
export function ScrollSentinel({
    onVisible,
    disabled = false,
    loadingMessage = 'Loading more…',
    isLoading = false,
}: ScrollSentinelProps): React.JSX.Element {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (disabled || !ref.current) return;

        const el = ref.current;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) {
                    onVisible();
                }
            },
            { rootMargin: '200px' },
        );

        observer.observe(el);

        return () => observer.disconnect();
    }, [disabled, onVisible]);

    if (isLoading) {
        return (
            <p className="font-bold text-nb-black/50 dark:text-white/40 uppercase text-xs tracking-wide text-center py-2">
                {loadingMessage}
            </p>
        );
    }

    return <div ref={ref} aria-hidden="true" />;
}
