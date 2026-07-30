import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge.js';

describe('Badge', () => {
    it('renders its content', () => {
        render(<Badge variant="priority">Priority 1</Badge>);

        expect(screen.getByText('Priority 1')).toBeInTheDocument();
    });

    it('has no axe violations', async () => {
        const { container } = render(<Badge variant="source">Todoist</Badge>);

        expect(await axe(container)).toHaveNoViolations();
    });
});
