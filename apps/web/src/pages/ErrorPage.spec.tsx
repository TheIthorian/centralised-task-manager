import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

// Mock useRouteError to control what error is returned
vi.mock('react-router', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router')>();
    return {
        ...actual,
        useRouteError: vi.fn(),
    };
});

import { useRouteError } from 'react-router';
import { ErrorPage } from './ErrorPage.js';

describe('ErrorPage', () => {
    it('renders error heading', () => {
        vi.mocked(useRouteError).mockReturnValue(new Error('Route crashed'));
        render(
            <MemoryRouter>
                <ErrorPage />
            </MemoryRouter>,
        );
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders reload button', () => {
        vi.mocked(useRouteError).mockReturnValue(new Error('Route crashed'));
        render(
            <MemoryRouter>
                <ErrorPage />
            </MemoryRouter>,
        );
        expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    });

    it('renders go home link', () => {
        vi.mocked(useRouteError).mockReturnValue(new Error('Route crashed'));
        render(
            <MemoryRouter>
                <ErrorPage />
            </MemoryRouter>,
        );
        expect(screen.getByRole('link', { name: /go to tasks/i })).toBeInTheDocument();
    });

    it('handles non-Error thrown values', () => {
        vi.mocked(useRouteError).mockReturnValue('a plain string error');
        render(
            <MemoryRouter>
                <ErrorPage />
            </MemoryRouter>,
        );
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
});
