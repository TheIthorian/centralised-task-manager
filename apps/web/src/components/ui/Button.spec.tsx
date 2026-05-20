import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button.js';

describe('Button', () => {
    it('renders children', () => {
        render(<Button>Click me</Button>);
        expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('calls onClick when clicked', async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();

        render(<Button onClick={onClick}>Go</Button>);
        await user.click(screen.getByRole('button'));

        expect(onClick).toHaveBeenCalledOnce();
    });

    it('is disabled when disabled prop is true', () => {
        render(<Button disabled>Nope</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
