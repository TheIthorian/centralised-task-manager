import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonSize = 'md' | 'lg';

/**
 * The Quiet Slate button skin, shared by `Button` and `LinkButton` so a control that happens
 * to navigate cannot drift away from one that submits.
 */
export function buttonClassName({
    variant = 'primary',
    size = 'md',
    className,
}: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
}): string {
    return clsx(
        'inline-flex items-center justify-center gap-2 rounded-ctm',
        // 44px on a phone whatever the type scale says, so a thumb has a target.
        'min-h-11 border font-semibold md:min-h-0',
        'cursor-pointer motion-safe:transition-[color,background-color,border-color,transform] motion-safe:duration-press',
        // A press that moves confirms the tap on a touch screen, where there is no hover state.
        'motion-safe:active:scale-[0.97] disabled:active:scale-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'md' && 'px-3.5 py-1.5 text-sm',
        size === 'lg' && 'px-5 py-3 text-base md:min-h-11',
        variant === 'primary' && 'border-transparent bg-accent text-accent-fg hover:opacity-90',
        variant === 'secondary' && 'border-line bg-panel text-fg hover:bg-nav-on-bg',
        variant === 'ghost' && 'border-transparent bg-transparent text-muted hover:text-fg',
        variant === 'danger' && 'border-transparent bg-warn text-accent-fg hover:opacity-90',
        className,
    );
}
