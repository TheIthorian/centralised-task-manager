import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

type ModalProps = {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    /** Tailwind max-width class applied on desktop. Defaults to `md:max-w-md`. */
    widthClassName?: string;
};

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
    useEffect(() => {
        if (!open) return;

        const handler = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handler);

        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            <div className="absolute inset-0 bg-black/35 backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />
            <div
                className={clsx(
                    'relative z-10 w-full',
                    widthClassName,
                    'border border-line bg-panel text-fg md:rounded-ctm md:shadow-overlay',
                    'p-6',
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
