import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router';
import { NotFoundPage } from './NotFoundPage.js';

describe('NotFoundPage', () => {
    it('renders 404 heading', () => {
        render(
            <MemoryRouter>
                <NotFoundPage />
            </MemoryRouter>,
        );
        expect(screen.getByText('404')).toBeInTheDocument();
    });

    it('renders descriptive copy', () => {
        render(
            <MemoryRouter>
                <NotFoundPage />
            </MemoryRouter>,
        );
        expect(screen.getByText("This page doesn't exist.")).toBeInTheDocument();
    });

    it('renders Go to Tasks link', () => {
        render(
            <MemoryRouter>
                <NotFoundPage />
            </MemoryRouter>,
        );
        expect(screen.getByRole('link', { name: /go to tasks/i })).toBeInTheDocument();
    });

    it('renders Back button', () => {
        render(
            <MemoryRouter>
                <NotFoundPage />
            </MemoryRouter>,
        );
        expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });
});
