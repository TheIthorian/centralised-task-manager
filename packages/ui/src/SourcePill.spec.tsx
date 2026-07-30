import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { SourcePill } from './SourcePill.js';

describe('SourcePill', () => {
    it('names the account it came from', () => {
        render(<SourcePill brand="google_tasks" label="Google Tasks" />);

        expect(screen.getByText('Google Tasks')).toBeInTheDocument();
    });

    it('has no axe violations', async () => {
        const { container } = render(<SourcePill brand="todoist" label="Todoist" />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
