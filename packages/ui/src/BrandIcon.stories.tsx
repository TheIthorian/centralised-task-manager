import type { Meta, StoryObj } from '@storybook/react-vite';
import { BrandIcon } from './BrandIcon.js';
import { BRAND_ICONS, type BrandKey } from './brand-icons.js';

const meta = {
    title: 'Primitives/BrandIcon',
    component: BrandIcon,
} satisfies Meta<typeof BrandIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

const brands = Object.keys(BRAND_ICONS) as BrandKey[];

export const EveryBrand: Story = {
    args: { brand: 'todoist' },
    render: () => (
        <div className="flex flex-col gap-4 text-fg">
            {[16, 24].map((size) => (
                <div key={size} className="flex items-center gap-3">
                    {brands.map((brand) => (
                        <BrandIcon key={brand} brand={brand} size={size} />
                    ))}
                </div>
            ))}
        </div>
    ),
};
