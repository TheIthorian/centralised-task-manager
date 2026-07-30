import { BRAND_ICONS } from './brand-icons.js';
import type { BrandKey } from './brand-icons.js';

type BrandIconProps = {
    brand: BrandKey;
    size?: number;
    className?: string;
};

/** Renders a third-party brand mark at a uniform size, kept legible in both themes. */
export function BrandIcon({ brand, size = 16, className = '' }: BrandIconProps): React.JSX.Element {
    const icon = BRAND_ICONS[brand];
    const box = `shrink-0 ${className}`.trim();

    if (icon.kind === 'image') {
        return (
            <img
                src={icon.src}
                alt=""
                width={size}
                height={size}
                style={{ width: size, height: size }}
                className={`${box} rounded-[3px] object-contain`}
            />
        );
    }

    const { Svg } = icon;

    return (
        <Svg
            width={size}
            height={size}
            style={{ width: size, height: size }}
            className={box}
            aria-hidden="true"
            focusable="false"
        />
    );
}
