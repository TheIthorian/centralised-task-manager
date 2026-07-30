import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Chip, FilterMenu, Input, type FilterGroup } from '@ctm/ui';
import type { TaskFilter } from '@ctm/api-client';
import {
    DUE_CONDITIONS,
    FIELD_CONDITIONS,
    hasCondition,
    type Condition,
} from '../../lib/task-conditions.js';
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
};

/** The row above the list: which slice of the server's tasks, then a menu to narrow it. */
export function FilterBar({
    filter,
    onFilterChange,
    conditions,
    onToggleCondition,
    onClearConditions,
    sources,
    search,
    onApplySearch,
}: FilterBarProps): React.JSX.Element {
    const { t } = useTranslation();
    const [views, setViews] = useState<SavedView[]>(readSavedViews);
    const [newViewName, setNewViewName] = useState<string | null>(null);

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
            options: DUE_CONDITIONS.map((value) =>
                option({ kind: 'due', value }, t(`tasks.filters.due.${value}`)),
            ),
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

    const saveView = (): void => {
        if (!newViewName?.trim()) return;

        setViews(addSavedView({ name: newViewName, search }));
        setNewViewName(null);
    };

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {BASE_FILTERS.map((value) => (
                <Chip
                    key={value}
                    label={t(`tasks.filters.${value}`)}
                    selected={filter === value}
                    onToggle={() => onFilterChange(value)}
                />
            ))}

            <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />

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

            {views.map((view) => (
                <span key={view.id} className="inline-flex items-center">
                    <Chip
                        label={view.name}
                        selected={view.search === search}
                        onToggle={() => onApplySearch(view.search)}
                    />
                    <button
                        type="button"
                        onClick={() => setViews(removeSavedView(view.id))}
                        aria-label={t('tasks.filters.removeView', { name: view.name })}
                        className="cursor-pointer rounded-ctm px-1 text-xs text-muted transition-colors duration-press hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                        ×
                    </button>
                </span>
            ))}

            {newViewName === null
                ? conditions.length > 0 && (
                      <Button variant="ghost" onClick={() => setNewViewName('')} className="text-xs">
                          {t('tasks.filters.saveAsView')}
                      </Button>
                  )
                : (
                      <form
                          className="flex items-center gap-1.5"
                          onSubmit={(event) => {
                              event.preventDefault();
                              saveView();
                          }}
                      >
                          <Input
                              aria-label={t('tasks.filters.viewName')}
                              value={newViewName}
                              onChange={(event) => setNewViewName(event.target.value)}
                              placeholder={t('tasks.filters.viewName')}
                              maxLength={40}
                              autoFocus
                          />
                          <Button type="submit" variant="secondary" className="text-xs">
                              {t('common.save')}
                          </Button>
                      </form>
                  )}
        </div>
    );
}
