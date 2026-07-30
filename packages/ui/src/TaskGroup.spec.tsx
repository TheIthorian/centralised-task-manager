import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { TaskGroup } from './TaskGroup.js';

describe('TaskGroup', () => {
    it('shows the heading and count', () => {
        render(
            <TaskGroup heading="Overdue" count={2} emptyBody="Nothing overdue.">
                <div>a row</div>
            </TaskGroup>,
        );

        expect(screen.getByText('Overdue')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('a row')).toBeInTheDocument();
    });

    it('shows the per-group empty copy when it has no rows', () => {
        render(<TaskGroup heading="Overdue" count={0} emptyBody="Nothing overdue." />);

        expect(screen.getByText('Nothing overdue.')).toBeInTheDocument();
    });

    it('has no axe violations', async () => {
        const { container } = render(
            <TaskGroup heading="Overdue" count={1} emptyBody="Nothing overdue.">
                <div>a row</div>
            </TaskGroup>,
        );

        expect(await axe(container)).toHaveNoViolations();
    });
});
