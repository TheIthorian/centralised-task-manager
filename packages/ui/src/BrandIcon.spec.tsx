import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { BrandIcon } from './BrandIcon.js';

describe('BrandIcon', () => {
    it('is decorative, so it exposes no accessible name', () => {
        const { container } = render(<BrandIcon brand="todoist" />);

        expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    });

    it('falls back to a bitmap for brands without vector paths', () => {
        const { container } = render(<BrandIcon brand="chatgpt" />);

        expect(container.querySelector('img')).not.toBeNull();
    });

    it('has no axe violations', async () => {
        const { container } = render(<BrandIcon brand="todoist" />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
