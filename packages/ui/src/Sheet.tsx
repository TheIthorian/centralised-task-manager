import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

export type SheetProps = {
    open: boolean;
    onClose: () => void;
    /** Id of the heading inside `children` that names the dialog. */
    labelledBy: string;
    /** Accessible name for the drag handle, which also closes the sheet when activated. */
    dragHandleLabel: string;
    children: React.ReactNode;
    /** Width of the desktop side panel. */
    desktopWidthClassName?: string;
};

/** Past this many pixels of downward drag, releasing dismisses instead of springing back. */
const DISMISS_THRESHOLD_PX = 96;

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Overlay surface for content that belongs beside the page rather than on top of it: a bottom
 * sheet on a phone, a right side panel from 768px up. The sheet keeps the list visible behind
 * it and can be thrown away downward, which a full screen view cannot.
 */
export function Sheet({
    open,
    onClose,
    labelledBy,
    dragHandleLabel,
    children,
    desktopWidthClassName = 'md:w-[690px]',
}: SheetProps): React.JSX.Element | null {
    const dialogRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<number | null>(null);
    const [dragOffset, setDragOffset] = useState(0);

    useEffect(() => {
        if (!open) return;

        const opener = document.activeElement;

        // The page behind must not scroll under the sheet: on a phone the scroll chain
        // otherwise moves the list instead of the sheet body.
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Escape listens on the document, not the dialog, so it still closes before the user
        // has tabbed into the sheet.
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', onKeyDown);
        dialogRef.current?.focus();

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;

            if (opener instanceof HTMLElement) opener.focus();
        };
    }, [open, onClose]);

    useEffect(() => {
        if (!open) setDragOffset(0);
    }, [open]);

    if (!open) return null;

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
        if (event.key !== 'Tab') return;

        trapFocus({ event, container: dialogRef.current });
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>): void => {
        dragStartRef.current = event.clientY;

        // Capture keeps the drag alive when the finger leaves the handle. jsdom does not
        // implement it, and the gesture is still correct without it.
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // No capture available. The pointer handlers on the handle still fire.
        }
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>): void => {
        if (dragStartRef.current === null) return;

        setDragOffset(Math.max(0, event.clientY - dragStartRef.current));
    };

    const handlePointerUp = (): void => {
        if (dragStartRef.current === null) return;

        dragStartRef.current = null;

        if (dragOffset > DISMISS_THRESHOLD_PX) {
            onClose();
            return;
        }

        setDragOffset(0);
    };

    const dragging = dragStartRef.current !== null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-end md:items-stretch">
            <div
                className="absolute inset-0 bg-fg/25 md:bg-fg/10 motion-safe:animate-[ctm-fade_var(--duration-surface)_ease-out]"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
                style={dragOffset ? { transform: `translateY(${dragOffset}px)` } : undefined}
                className={clsx(
                    'relative z-10 flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-overlay bg-panel text-fg',
                    'md:max-h-none md:h-full md:rounded-none md:border-l md:border-line md:shadow-overlay',
                    desktopWidthClassName,
                    !dragging && 'motion-safe:transition-transform motion-safe:duration-surface',
                    'motion-safe:animate-[ctm-slide-up_var(--duration-surface)_ease-out] md:motion-safe:animate-[ctm-slide-in_var(--duration-surface)_ease-out]',
                )}
            >
                <button
                    type="button"
                    aria-label={dragHandleLabel}
                    onClick={onClose}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className="flex h-11 w-full shrink-0 touch-none items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:hidden"
                >
                    <span aria-hidden="true" className="h-1 w-9 rounded-full bg-line" />
                </button>
                {children}
            </div>
        </div>,
        document.body,
    );
}

/** Keeps Tab inside the dialog, so the keyboard cannot walk onto the page behind the scrim. */
function trapFocus({
    event,
    container,
}: {
    event: React.KeyboardEvent<HTMLDivElement>;
    container: HTMLDivElement | null;
}): void {
    if (!container) return;

    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (!first || !last) return;

    const active = document.activeElement;

    if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
    }

    if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
    }
}
