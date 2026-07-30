import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Banner } from './Banner.js';

describe('Banner', () => {
    it('announces itself as a status region', () => {
        render(
            <Banner
                tone="warn"
                title="Google Tasks needs reconnecting"
                body="Its token expired 2 days ago. Tasks from this account are stale until you sign in again."
            />,
        );

        expect(screen.getByRole('status')).toHaveTextContent('Google Tasks needs reconnecting');
    });

    it('has no axe violations', async () => {
        const { container } = render(<Banner tone="info" title="Syncing" body="This takes about a minute." />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
