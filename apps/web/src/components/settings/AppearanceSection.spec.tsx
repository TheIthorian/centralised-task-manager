import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppearanceSection } from './AppearanceSection.js';
import { DensityProvider } from '../../theme/DensityContext.js';
import { ThemeProvider } from '../../theme/ThemeContext.js';

function renderSection(): void {
    render(
        <ThemeProvider>
            <DensityProvider>
                <AppearanceSection />
            </DensityProvider>
        </ThemeProvider>,
    );
}

describe('AppearanceSection', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-density');
    });

    it('offers the theme and density controls', () => {
        renderSection();

        expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
        expect(screen.getByRole('radiogroup', { name: 'Density' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Comfortable' })).toBeChecked();
    });

    it('applies the chosen density to the document element', async () => {
        renderSection();

        await userEvent.click(screen.getByRole('radio', { name: 'Spacious' }));

        expect(document.documentElement).toHaveAttribute('data-density', 'spacious');
    });
});
