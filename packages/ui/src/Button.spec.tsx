import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';

describe('Button', () => {
    it('renders its label as an accessible button', () => {
        render(<Button>Save view</Button>);

        expect(screen.getByRole('button', { name: 'Save view' })).toBeInTheDocument();
    });

    it('calls onClick once per click', async () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Sync now</Button>);

        await userEvent.click(screen.getByRole('button', { name: 'Sync now' }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not fire when disabled', async () => {
        const onClick = vi.fn();
        render(
            <Button disabled onClick={onClick}>
                Disconnect
            </Button>,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

        expect(onClick).not.toHaveBeenCalled();
    });

    it('has no axe violations', async () => {
        const { container } = render(<Button>Sync now</Button>);

        expect(await axe(container)).toHaveNoViolations();
    });
});
