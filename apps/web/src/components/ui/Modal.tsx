import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
}

/**
 * Portal-based modal. On mobile slides up from the bottom; on desktop is centred.
 * Closes on Escape key or backdrop click.
 */
export function Modal({ open, onClose, title, children }: ModalProps): React.JSX.Element | null {
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
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-nb-black/60"
                onClick={onClose}
                aria-hidden="true"
            />
            {/* Panel */}
            <div
                className={clsx(
                    'relative z-10 w-full md:max-w-md',
                    'bg-white border-t-4 md:border-4 border-nb-black',
                    'md:shadow-[5px_5px_0px_#111]',
                    'p-6',
                )}
                role="dialog"
                aria-modal="true"
            >
                {title && (
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-black uppercase tracking-tight text-nb-black">{title}</h2>
                        <button
                            onClick={onClose}
                            className="font-black text-nb-black hover:text-nb-red text-lg leading-none"
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
