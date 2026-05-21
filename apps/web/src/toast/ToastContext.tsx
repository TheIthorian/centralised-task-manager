import { createContext, useContext, useRef, useState, type ReactNode } from 'react';

export type ToastMessage = {
    id: number;
    title: string;
    description: string;
};

type ToastContextValue = {
    showToast: ({ title, description }: { title: string; description: string }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Provides global transient toast notifications. */
export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const nextId = useRef(1);

    const showToast = ({ title, description }: { title: string; description: string }): void => {
        const id = nextId.current++;
        setToasts((current) => [...current, { id, title, description }]);

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
                        className="border-2 border-nb-black bg-white px-4 py-3 shadow-[4px_4px_0px_#111]"
                    >
                        <p className="text-xs font-black uppercase tracking-wide text-nb-black">{toast.title}</p>
                        <p className="mt-1 text-sm font-bold text-nb-black/80">{toast.description}</p>
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
