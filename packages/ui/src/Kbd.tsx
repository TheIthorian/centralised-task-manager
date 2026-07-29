/** A single keycap, for shortcut hints. */
export function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
    return (
        <kbd className="rounded-[4px] border border-line bg-nav-on-bg px-1.5 py-0.5 font-mono text-[10px] text-muted">
            {children}
        </kbd>
    );
}
