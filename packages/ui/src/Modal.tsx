import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { usePresence } from './usePresence.js';

type ModalProps = {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    /** Tailwind max-width class applied on desktop. Defaults to `md:max-w-md`. */
    widthClassName?: string;
};

/** Kept in step with `--duration-leave`, which drives the exit keyframes. */
const EXIT_MS = 240;

/**
 * Portal-based modal. On mobile slides up from the bottom; on desktop is centred.
 * Closes on Escape key or backdrop click.
 */
export function Modal({
    open,
    onClose,
    title,
    children,
    widthClassName = 'md:max-w-md',
}: ModalProps): React.JSX.Element | null {
    const { mounted, leaving } = usePresence({ open, exitDurationMs: EXIT_MS });

    useEffect(() => {
        if (!open) return;

        const handler = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handler);

        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!mounted) return null;

    return createPortal(
        <div
            className={clsx(
                'fixed inset-0 z-50 flex items-end md:items-center justify-center',
                leaving && 'pointer-events-none',
            )}
        >
            <div
                className={clsx(
                    'absolute inset-0 bg-black/35 backdrop-blur-[3px]',
                    leaving
                        ? 'motion-safe:animate-[ctm-fade-out_var(--duration-leave)_var(--ease-exit)_forwards]'
                        : 'motion-safe:animate-[ctm-fade_var(--duration-surface)_var(--ease-surface)]',
                )}
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                className={clsx(
                    'relative z-10 w-full',
                    widthClassName,
                    'border border-line bg-panel text-fg md:rounded-ctm md:shadow-overlay',
                    'p-6',
                    leaving
                        ? [
                              'motion-safe:animate-[ctm-slide-down_var(--duration-leave)_var(--ease-exit)_forwards]',
                              'md:motion-safe:animate-[ctm-sink_var(--duration-leave)_var(--ease-exit)_forwards]',
                          ]
                        : [
                              'motion-safe:animate-[ctm-slide-up_var(--duration-surface)_var(--ease-surface)]',
                              'md:motion-safe:animate-[ctm-rise_var(--duration-surface)_var(--ease-surface)]',
                          ],
                )}
                role="dialog"
                aria-modal="true"
            >
                {title && (
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold tracking-tight text-fg">{title}</h2>
                        <button
                            onClick={onClose}
                            type="button"
                            className="cursor-pointer text-lg leading-none text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>
                )}
                {children}
            </div>
        </div>,
        document.body,
    );
}
