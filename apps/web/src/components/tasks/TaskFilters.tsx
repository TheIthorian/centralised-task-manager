import { useTranslation } from 'react-i18next';
import { Chip } from '@ctm/ui';
import type { TaskFilter } from '@ctm/api-client';

const filters: TaskFilter[] = ['all', 'today', 'upcoming', 'done'];

type TaskFiltersProps = {
    active: TaskFilter;
    onChange: (filter: TaskFilter) => void;
};

/** The filter chip row above the list. */
export function TaskFilters({ active, onChange }: TaskFiltersProps): React.JSX.Element {
    const { t } = useTranslation();

    return (
        <div className="flex flex-wrap gap-1.5">
            {filters.map((value) => (
                <Chip
                    key={value}
                    label={t(`tasks.filters.${value}`)}
                    selected={active === value}
                    onToggle={() => onChange(value)}
                />
            ))}
        </div>
    );
}
