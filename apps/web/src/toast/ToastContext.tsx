import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Toast } from '@ctm/ui';
import { MissingProviderError } from '../lib/errors.js';

export type ToastMessage = {
    id: number;
    title: string;
    description: string;
    dedupeKey?: string;
};

type ShowToastParams = {
    title: string;
    description: string;
    /** When set, the toast is dropped if one with the same key is already on screen. */
    dedupeKey?: string;
};

type ToastContextValue = {
    showToast: (params: ShowToastParams) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 4000;

/** Provides global transient toast notifications. */
export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const nextId = useRef(1);

    const dismiss = useCallback((id: number): void => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const showToast = ({ title, description, dedupeKey }: ShowToastParams): void => {
        const id = nextId.current++;

        setToasts((current) => {
            // One rate-limited page can fail a dozen requests at once; stacking a toast per
            // failure buries the app under identical boxes.
            if (dedupeKey !== undefined && current.some((toast) => toast.dedupeKey === dedupeKey)) return current;

            return [...current, { id, title, description, dedupeKey }];
        });

        window.setTimeout(() => dismiss(id), DURATION_MS);
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3 px-4">
                {toasts.map((toast) => (
                    <Toast key={toast.id} title={toast.title} message={toast.description} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

/** Returns the toast API. Must be used inside ToastProvider. */
export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);

    if (!context) throw new MissingProviderError({ hook: 'useToast', provider: 'ToastProvider' });

    return context;
}
