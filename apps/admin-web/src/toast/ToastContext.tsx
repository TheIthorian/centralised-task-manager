import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Toast } from '@ctm/ui';
import { MissingProviderError } from '../lib/errors.js';

type ToastMessage = {
    id: number;
    message: string;
};

type ToastContextValue = {
    showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 4000;

/**
 * Transient confirmation of something the operator just did. System failures are not routed
 * here: they render as an inline banner, because a toast disappears before it can be acted on.
 */
export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const nextId = useRef(1);

    const dismiss = useCallback((id: number): void => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback(
        (message: string): void => {
            const id = nextId.current++;

            setToasts((current) => [...current, { id, message }]);
            window.setTimeout(() => dismiss(id), DURATION_MS);
        },
        [dismiss],
    );

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3 px-4">
                {toasts.map((toast) => (
                    <Toast key={toast.id} message={toast.message} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

/** Show a confirmation toast. Must be used inside {@link ToastProvider}. */
export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);

    if (!context) throw new MissingProviderError({ hook: 'useToast', provider: 'ToastProvider' });

    return context;
}
