import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastContext.js';

function Trigger({ dedupeKey }: { dedupeKey?: string }): React.JSX.Element {
    const { showToast } = useToast();

    return (
        <button
            onClick={() => {
                showToast({ title: 'Slow Down', description: 'Too many requests.', dedupeKey });
            }}
        >
            fire
        </button>
    );
}

describe('ToastProvider', () => {
    const fireTwice = (): void => {
        const button = screen.getByRole('button', { name: 'fire' });

        act(() => {
            button.click();
            button.click();
        });
    };

    it('shows one toast per call without a dedupe key', () => {
        render(
            <ToastProvider>
                <Trigger />
            </ToastProvider>,
        );

        fireTwice();

        expect(screen.getAllByText('Too many requests.')).toHaveLength(2);
    });

    it('collapses toasts that share a dedupe key', () => {
        render(
            <ToastProvider>
                <Trigger dedupeKey="rate_limited" />
            </ToastProvider>,
        );

        fireTwice();

        expect(screen.getAllByText('Too many requests.')).toHaveLength(1);
    });
});
