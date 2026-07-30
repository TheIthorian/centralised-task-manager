import { useTranslation } from 'react-i18next';
import { Button, FilterMenu, SegmentedControl, type FilterGroup } from '@ctm/ui';
import type { TaskFilter } from '@ctm/api-client';
import { DUE_CONDITIONS, FIELD_CONDITIONS, hasCondition, type Condition } from '../../lib/task-conditions.js';

const BASE_FILTERS: TaskFilter[] = ['all', 'today', 'upcoming', 'done'];

/** Sources get an option only when the app has a name for them. */
const KNOWN_SOURCES = ['local', 'todoist', 'google'] as const;

export type FilterBarProps = {
    filter: TaskFilter;
    onFilterChange: (filter: TaskFilter) => void;
    conditions: Condition[];
    onToggleCondition: (condition: Condition) => void;
    onClearConditions: () => void;
    /** Sources present in the loaded tasks, so the menu never offers an empty filter. */
    sources: string[];
    onNewTask: () => void;
};

/** The control row above the list: which slice, how to narrow it, and the way to add one. */
export function FilterBar({
    filter,
    onFilterChange,
    conditions,
    onToggleCondition,
    onClearConditions,
    sources,
    onNewTask,
}: FilterBarProps): React.JSX.Element {
    const { t } = useTranslation();

    // Built alongside the options so a menu selection resolves back to a typed condition
    // without casting the group id.
    const byKey = new Map<string, Condition>();

    const option = (condition: Condition, label: string): { value: string; label: string; checked: boolean } => {
        byKey.set(`${condition.kind}:${condition.value}`, condition);

        return { value: condition.value, label, checked: hasCondition({ conditions, condition }) };
    };

    const groups: FilterGroup[] = [
        {
            id: 'due',
            label: t('tasks.filters.groups.due'),
            options: DUE_CONDITIONS.map((value) => option({ kind: 'due', value }, t(`tasks.filters.due.${value}`))),
        },
        {
            id: 'field',
            label: t('tasks.filters.groups.field'),
            options: FIELD_CONDITIONS.map((value) =>
                option({ kind: 'field', value }, t(`tasks.filters.field.${value}`)),
            ),
        },
        {
            id: 'source',
            label: t('tasks.filters.groups.source'),
            options: KNOWN_SOURCES.filter((value) => sources.includes(value)).map((value) =>
                option({ kind: 'source', value }, t(`tasks.filters.sources.${value}`)),
            ),
        },
    ].filter((group) => group.options.length > 0);

    return (
        <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
                label={t('tasks.filters.sliceLabel')}
                value={filter}
                onChange={onFilterChange}
                options={BASE_FILTERS.map((value) => ({ value, label: t(`tasks.filters.${value}`) }))}
            />

            <div className="ml-1">
                <FilterMenu
                    label={t('tasks.filters.menuLabel')}
                    clearLabel={t('tasks.filters.clear')}
                    groups={groups}
                    onClear={onClearConditions}
                    onToggle={({ groupId, value }) => {
                        const condition = byKey.get(`${groupId}:${value}`);

                        if (condition) onToggleCondition(condition);
                    }}
                />
            </div>

            <Button onClick={onNewTask} className="ml-auto h-11 py-0 text-xs md:h-8">
                {t('tasks.newTask')}
            </Button>
        </div>
    );
}
