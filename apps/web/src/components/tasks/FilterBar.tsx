import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Input } from '@ctm/ui';
import type { TaskFilter } from '@ctm/api-client';
import {
    DUE_CONDITIONS,
    FIELD_CONDITIONS,
    hasCondition,
    type Condition,
} from '../../lib/task-conditions.js';
import { addSavedView, readSavedViews, removeSavedView, type SavedView } from '../../lib/saved-views.js';

const BASE_FILTERS: TaskFilter[] = ['all', 'today', 'upcoming', 'done'];

/** Sources get a chip only when the app has a name for them. */
const KNOWN_SOURCES = ['local', 'todoist', 'google'] as const;

export type FilterBarProps = {
    filter: TaskFilter;
    onFilterChange: (filter: TaskFilter) => void;
    conditions: Condition[];
    onToggleCondition: (condition: Condition) => void;
    /** Sources present in the loaded tasks, so the row never offers an empty filter. */
    sources: string[];
    /** The query string a saved view would restore. */
    search: string;
    onApplySearch: (search: string) => void;
};

/** The chip row above the list: which slice of the server's tasks, then how to narrow it. */
export function FilterBar({
    filter,
    onFilterChange,
    conditions,
    onToggleCondition,
    sources,
    search,
    onApplySearch,
}: FilterBarProps): React.JSX.Element {
    const { t } = useTranslation();
    const [views, setViews] = useState<SavedView[]>(readSavedViews);
    const [newViewName, setNewViewName] = useState<string | null>(null);

    const sourceChips = KNOWN_SOURCES.filter((source) => sources.includes(source));

    const saveView = (): void => {
        if (!newViewName?.trim()) return;

        setViews(addSavedView({ name: newViewName, search }));
        setNewViewName(null);
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
                {BASE_FILTERS.map((value) => (
                    <Chip
                        key={value}
                        label={t(`tasks.filters.${value}`)}
                        selected={filter === value}
                        onToggle={() => onFilterChange(value)}
                    />
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {DUE_CONDITIONS.map((value) => (
                    <ConditionChip
                        key={value}
                        condition={{ kind: 'due', value }}
                        label={t(`tasks.filters.due.${value}`)}
                        conditions={conditions}
                        onToggle={onToggleCondition}
                    />
                ))}
                {FIELD_CONDITIONS.map((value) => (
                    <ConditionChip
                        key={value}
                        condition={{ kind: 'field', value }}
                        label={t(`tasks.filters.field.${value}`)}
                        conditions={conditions}
                        onToggle={onToggleCondition}
                    />
                ))}
                {sourceChips.map((value) => (
                    <ConditionChip
                        key={value}
                        condition={{ kind: 'source', value }}
                        label={t(`tasks.filters.sources.${value}`)}
                        conditions={conditions}
                        onToggle={onToggleCondition}
                    />
                ))}
            </div>

            {(views.length > 0 || conditions.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5">
                    {views.map((view) => (
                        <span key={view.id} className="inline-flex items-center gap-1">
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

                    {newViewName === null ? (
                        conditions.length > 0 && (
                            <Button variant="ghost" onClick={() => setNewViewName('')} className="text-xs">
                                {t('tasks.filters.saveAsView')}
                            </Button>
                        )
                    ) : (
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
            )}
        </div>
    );
}

/** A chip bound to one condition, pressed when that condition is applied. */
function ConditionChip({
    condition,
    label,
    conditions,
    onToggle,
}: {
    condition: Condition;
    label: string;
    conditions: Condition[];
    onToggle: (condition: Condition) => void;
}): React.JSX.Element {
    return (
        <Chip
            label={label}
            selected={hasCondition({ conditions, condition })}
            onToggle={() => onToggle(condition)}
        />
    );
}
