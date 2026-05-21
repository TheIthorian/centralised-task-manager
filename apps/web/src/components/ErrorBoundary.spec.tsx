import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary.js';

function Bomb({ shouldThrow }: { shouldThrow: boolean }): React.JSX.Element {
    if (shouldThrow) throw new Error('Test explosion');
    return <div>All good</div>;
}

describe('ErrorBoundary', () => {
    beforeEach(() => {
        // Suppress console.error for expected throws
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders children when no error', () => {
        render(
            <ErrorBoundary>
                <Bomb shouldThrow={false} />
            </ErrorBoundary>,
        );
        expect(screen.getByText('All good')).toBeInTheDocument();
    });

    it('renders fallback on error', () => {
        render(
            <ErrorBoundary>
                <Bomb shouldThrow={true} />
            </ErrorBoundary>,
        );
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders custom fallback when provided', () => {
        render(
            <ErrorBoundary fallback={<div>Custom error UI</div>}>
                <Bomb shouldThrow={true} />
            </ErrorBoundary>,
        );
        expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    });

    it('shows reload button in default fallback', () => {
        render(
            <ErrorBoundary>
                <Bomb shouldThrow={true} />
            </ErrorBoundary>,
        );
        expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    });
});
