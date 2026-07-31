import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { UnverifiedAppNotice } from './UnverifiedAppNotice.js';

const copy = {
    title: 'Unverified app',
    body: 'This app registered itself. Anyone can register an app under any name.',
    hostsLabel: 'Sends you to',
};

describe('UnverifiedAppNotice', () => {
    it('states the warning in words rather than colour alone', () => {
        render(<UnverifiedAppNotice {...copy} hosts={[]} />);

        expect(screen.getByRole('status')).toHaveTextContent('Unverified app');
        expect(screen.getByRole('status')).toHaveTextContent('Anyone can register an app under any name.');
    });

    it('lists every redirect host', () => {
        render(<UnverifiedAppNotice {...copy} hosts={['claude.ai', 'localhost:4000']} />);

        expect(screen.getByText('claude.ai')).toBeInTheDocument();
        expect(screen.getByText('localhost:4000')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Sends you to');
    });

    it('omits the host line when the client registered no parseable redirect', () => {
        render(<UnverifiedAppNotice {...copy} hosts={[]} />);

        expect(screen.queryByText('Sends you to')).not.toBeInTheDocument();
    });

    it('has no axe violations', async () => {
        const { container } = render(<UnverifiedAppNotice {...copy} hosts={['claude.ai']} />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
