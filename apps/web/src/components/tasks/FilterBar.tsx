import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Chip, FilterMenu, SegmentedControl, type FilterGroup } from '@ctm/ui';
import type { TaskFilter } from '@ctm/api-client';
import { DUE_CONDITIONS, FIELD_CONDITIONS, hasCondition, type Condition } from '../../lib/task-conditions.js';
import { addSavedView, readSavedViews, removeSavedView, type SavedView } from '../../lib/saved-views.js';

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
    /** The query string a saved view would restore. */
    search: string;
    onApplySearch: (search: string) => void;
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
    search,
    onApplySearch,
    onNewTask,
}: FilterBarProps): React.JSX.Element {
    const { t } = useTranslation();
    const [views, setViews] = useState<SavedView[]>(readSavedViews);

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

            <div className="ml-1 flex flex-wrap items-center gap-2">
                <FilterMenu
                    label={t('tasks.filters.menuLabel')}
                    clearLabel={t('tasks.filters.clear')}
                    groups={groups}
                    onClear={onClearConditions}
                    onToggle={({ groupId, value }) => {
                        const condition = byKey.get(`${groupId}:${value}`);

                        if (condition) onToggleCondition(condition);
                    }}
                    onSaveView={(name) => setViews(addSavedView({ name, search }))}
                    labels={{
                        saveView: t('tasks.filters.saveAsView'),
                        viewName: t('tasks.filters.viewName'),
                        save: t('common.save'),
                    }}
                />

                {views.map((view) => (
                    <Chip
                        key={view.id}
                        label={view.name}
                        tone="subtle"
                        selected={view.search === search}
                        onToggle={() => onApplySearch(view.search)}
                        onRemove={() => setViews(removeSavedView(view.id))}
                        removeLabel={t('tasks.filters.removeView', { name: view.name })}
                    />
                ))}
            </div>

            <Button onClick={onNewTask} className="ml-auto h-11 py-0 text-xs md:h-8">
                {t('tasks.newTask')}
            </Button>
        </div>
    );
}
