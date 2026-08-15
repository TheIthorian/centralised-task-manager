/** Placeholder rows shaped like the list they replace, so nothing jumps when data lands. */
export function Skeleton({ rows = 3 }: { rows?: number }): React.JSX.Element {
    return (
        <div className="flex flex-col gap-2" aria-hidden="true">
            {Array.from({ length: rows }, (_, i) => (
                <span
                    key={i}
                    className="h-4 rounded-ctm bg-hair motion-safe:animate-[ctm-pulse_1.6s_ease-in-out_infinite]"
                    // Offsetting each row turns a block of flashing bars into one travelling wave.
                    style={{ width: `${88 - i * 12}%`, animationDelay: `${i * 120}ms` }}
                />
            ))}
        </div>
    );
}
