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
            <p className="py-2 text-center text-xs text-muted" aria-live="polite">
                {loadingMessage}
            </p>
        );
    }

    return <div ref={ref} aria-hidden="true" />;
}
