import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { DensityProvider, useDensity } from './DensityContext.js';

function Probe(): React.JSX.Element {
    const { density, setDensity } = useDensity();

    return (
        <>
            <span>{density}</span>
            <button type="button" onClick={() => setDensity('compact')}>
                make it compact
            </button>
        </>
    );
}

function renderProbe(): void {
    render(
        <DensityProvider>
            <Probe />
        </DensityProvider>,
    );
}

describe('useDensity', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-density');
    });

    it('defaults to comfortable', () => {
        renderProbe();

        expect(screen.getByText('comfortable')).toBeInTheDocument();
        expect(document.documentElement).toHaveAttribute('data-density', 'comfortable');
    });

    it('restores the stored preference', () => {
        localStorage.setItem('ctm.density', 'spacious');

        renderProbe();

        expect(document.documentElement).toHaveAttribute('data-density', 'spacious');
    });

    it('ignores a value it does not recognise rather than rendering nothing', () => {
        localStorage.setItem('ctm.density', 'enormous');

        renderProbe();

        expect(screen.getByText('comfortable')).toBeInTheDocument();
    });

    it('persists a change', async () => {
        renderProbe();

        await userEvent.click(screen.getByRole('button', { name: 'make it compact' }));

        expect(localStorage.getItem('ctm.density')).toBe('compact');
        expect(document.documentElement).toHaveAttribute('data-density', 'compact');
    });
});
