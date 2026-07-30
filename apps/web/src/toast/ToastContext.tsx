import { createContext, useContext, useRef, useState, type ReactNode } from 'react';

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

/** Provides global transient toast notifications. */
export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const nextId = useRef(1);

    const showToast = ({ title, description, dedupeKey }: ShowToastParams): void => {
        const id = nextId.current++;

        setToasts((current) => {
            // One rate-limited page can fail a dozen requests at once; stacking a toast per
            // failure buries the app under identical boxes.
            if (dedupeKey !== undefined && current.some((toast) => toast.dedupeKey === dedupeKey)) return current;

            return [...current, { id, title, description, dedupeKey }];
        });

        window.setTimeout(() => {
            setToasts((current) => current.filter((toast) => toast.id !== id));
        }, 4000);
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-3 px-4">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className="border border-line bg-white px-4 py-3 shadow-[4px_4px_0px_#111] rounded-ctm"
                    >
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-fg">{toast.title}</p>
                        <p className="mt-1 text-sm font-medium text-fg/80">{toast.description}</p>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

/** Returns the toast API. Must be used inside ToastProvider. */
export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);

    if (!context) throw new Error('useToast must be used inside ToastProvider');

    return context;
}
