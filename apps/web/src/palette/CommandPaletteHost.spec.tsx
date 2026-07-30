import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { CommandPaletteHost } from './CommandPaletteHost.js';
import { DensityProvider } from '../theme/DensityContext.js';
import { ThemeProvider } from '../theme/ThemeContext.js';

const logout = vi.fn();

vi.mock('../auth/AuthContext.js', () => ({
    useAuth: () => ({ logout }),
}));

function Location(): React.JSX.Element {
    return <span data-testid="path">{useLocation().pathname}</span>;
}

function renderHost(): void {
    render(
        <MemoryRouter initialEntries={['/tasks']}>
            <ThemeProvider>
                <DensityProvider>
                    <CommandPaletteHost />
                    <Routes>
                        <Route path="*" element={<Location />} />
                    </Routes>
                </DensityProvider>
            </ThemeProvider>
        </MemoryRouter>,
    );
}

describe('CommandPaletteHost', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        document.documentElement.removeAttribute('data-density');
    });

    it('stays closed until the shortcut is pressed', async () => {
        renderHost();

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await userEvent.keyboard('{Meta>}k{/Meta}');

        expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    });

    it('opens from the visible trigger, for anyone without a keyboard', async () => {
        renderHost();

        await userEvent.click(screen.getByRole('button', { name: 'Open the command palette' }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('navigates and closes when a view command is run', async () => {
        renderHost();

        await userEvent.keyboard('{Control>}k{/Control}');
        await userEvent.type(screen.getByRole('combobox'), 'calendar');
        await userEvent.keyboard('{Enter}');

        expect(screen.getByTestId('path')).toHaveTextContent('/calendar');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('applies a preference command without leaving the page', async () => {
        renderHost();

        await userEvent.keyboard('{Control>}k{/Control}');
        await userEvent.type(screen.getByRole('combobox'), 'density: compact');
        await userEvent.keyboard('{Enter}');

        expect(document.documentElement).toHaveAttribute('data-density', 'compact');
        expect(screen.getByTestId('path')).toHaveTextContent('/tasks');
    });

    it('closes on escape', async () => {
        renderHost();

        await userEvent.keyboard('{Control>}k{/Control}');
        await userEvent.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
