import { type AnchorHTMLAttributes } from 'react';
import { buttonClassName, type ButtonSize, type ButtonVariant } from './button-styles.js';

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
};

/**
 * A link wearing the button skin. Navigation is an anchor, not a button with an onClick:
 * only an anchor gives the browser its own affordances (open in a new tab, copy the target).
 */
export function LinkButton({
    variant = 'primary',
    size = 'md',
    className,
    children,
    ...props
}: LinkButtonProps): React.JSX.Element {
    return (
        <a className={buttonClassName({ variant, size, className })} {...props}>
            {children}
        </a>
    );
}
