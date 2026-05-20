import clsx from 'clsx';
import type { TaskFilter } from '@ctm/api-client';

const filters: { value: TaskFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'done', label: 'Done' },
];

interface TaskFiltersProps {
    active: TaskFilter;
    onChange: (filter: TaskFilter) => void;
}

/** Pill-button filter row. Active pill has yellow background. */
export function TaskFilters({ active, onChange }: TaskFiltersProps): React.JSX.Element {
    return (
        <div className="flex gap-2 flex-wrap">
            {filters.map(({ value, label }) => (
                <button
                    key={value}
                    onClick={() => onChange(value)}
                    className={clsx(
                        'px-3 py-1 border-2 border-nb-black font-black uppercase text-xs tracking-wide',
                        'transition-colors duration-100',
                        active === value
                            ? 'bg-nb-yellow text-nb-black'
                            : 'bg-white text-nb-black hover:bg-nb-yellow/40',
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
