import { type ButtonHTMLAttributes } from 'react';
import { buttonClassName, type ButtonSize, type ButtonVariant } from './button-styles.js';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
};

/** Quiet Slate button: one accent, a hairline border, and no offset shadow. */
export function Button({
    variant = 'primary',
    size = 'md',
    className,
    children,
    ...props
}: ButtonProps): React.JSX.Element {
    return (
        <button className={buttonClassName({ variant, size, className })} {...props}>
            {children}
        </button>
    );
}
