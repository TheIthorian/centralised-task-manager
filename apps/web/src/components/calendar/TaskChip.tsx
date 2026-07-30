import clsx from 'clsx';
import type { TaskDto } from '@ctm/api-client';

/*
 * A day cell holds several of these, so a filled block would turn the month into a colour
 * chart. Chips are a tint with a coloured edge: legible, and the warning colour still stands
 * out because only the top priority gets it.
 */
const PRIORITY_CHIP_CLASS: Record<number, string> = {
    1: 'bg-warn-bg text-warn border-l-2 border-l-warn',
    2: 'bg-accent/12 text-fg border-l-2 border-l-accent',
    3: 'bg-nav-on-bg text-fg border-l-2 border-l-line',
    4: 'bg-nav-on-bg text-muted border-l-2 border-l-line',
};

export type TaskChipProps = {
    task: TaskDto;
    onOpen: (task: TaskDto) => void;
    /** Roomier ranges have space for a second line, so the title is not truncated. */
    wrap?: boolean;
};

/** One task inside a calendar day. */
export function TaskChip({ task, onOpen, wrap = false }: TaskChipProps): React.JSX.Element {
    return (
        <button
            type="button"
            onClick={() => onOpen(task)}
            className={clsx(
                'cursor-pointer rounded-ctm border border-line px-1.5 py-0.5 text-left text-xs font-medium',
                'transition-colors duration-press hover:border-fg/25',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                PRIORITY_CHIP_CLASS[task.priority ?? 3],
                wrap ? 'whitespace-normal' : 'truncate',
                task.completed && 'line-through opacity-50',
            )}
        >
            {task.title}
        </button>
    );
}
