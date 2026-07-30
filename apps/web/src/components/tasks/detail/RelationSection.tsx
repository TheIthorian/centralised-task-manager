import { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Button } from '@ctm/ui';
import type { RelationType, TaskDto, TaskRelationDto } from '@ctm/api-client';
import { useAuth } from '../../../auth/AuthContext.js';
import { DetailSection, FIELD_CONTROL_CLASS, FIELD_HEIGHT_CLASS, FIELD_LABEL_CLASS } from './DetailSection.js';
import { DetailSelect } from './DetailSelect.js';
import type { FieldOwnership } from './field-ownership.js';

const RELATION_TYPES: RelationType[] = ['parent', 'child', 'next', 'previous', 'related'];

const MAX_SUGGESTIONS = 8;

type RelationSectionProps = {
    taskId: string;
    relations: TaskRelationDto[];
    candidates: TaskDto[];
    ownership: FieldOwnership;
    disabled: boolean;
};

/** Links between this task and others. Each link is written as it is added or removed. */
export function RelationSection({
    taskId,
    relations: initialRelations,
    candidates,
    ownership,
    disabled,
}: RelationSectionProps): React.JSX.Element {
    const { t } = useTranslation();
    const { api } = useAuth();
    const searchId = useId();
    const listId = useId();
    const [relations, setRelations] = useState<TaskRelationDto[]>(initialRelations);
    const [type, setType] = useState<RelationType>('related');
    const [targetTaskId, setTargetTaskId] = useState('');
    const [search, setSearch] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);

    const addMutation = useMutation({
        mutationFn: (dto: TaskRelationDto) => api.addRelation({ id: taskId, dto }),
        onSuccess: (updated: TaskDto) => {
            setRelations(updated.relations);
            setTargetTaskId('');
            setSearch('');
            setMenuOpen(false);
        },
    });

    const removeMutation = useMutation({
        mutationFn: (dto: TaskRelationDto) => api.removeRelation({ id: taskId, dto }),
        onSuccess: (updated: TaskDto) => setRelations(updated.relations),
    });

    const busy = disabled || addMutation.isPending || removeMutation.isPending;
    const titleById = new Map(candidates.map((candidate) => [candidate.id, candidate.title]));
    const matches = matchTasks({ tasks: candidates, excludeId: taskId, term: search });

    return (
        <DetailSection title={t('taskDetail.relations.title')} ownership={ownership}>
            {relations.length === 0 ? (
                <p className="text-xs text-muted">{t('taskDetail.relations.empty')}</p>
            ) : (
                <ul className="flex flex-col gap-1.5">
                    {relations.map((relation) => {
                        const title = titleById.get(relation.targetTaskId) ?? relation.targetTaskId;

                        return (
                            <li
                                key={`${relation.type}:${relation.targetTaskId}`}
                                className="flex items-center gap-2 text-sm"
                            >
                                <Badge variant="neutral">{t(`taskDetail.relations.types.${relation.type}`)}</Badge>
                                <span className="flex-1 truncate text-fg">{title}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={busy}
                                    aria-label={t('taskDetail.relations.removeLabel', { title })}
                                    onClick={() => removeMutation.mutate(relation)}
                                    className={FIELD_HEIGHT_CLASS}
                                >
                                    {t('taskDetail.relations.remove')}
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="flex flex-col gap-2 md:flex-row md:items-end">
                <DetailSelect
                    label={t('taskDetail.relations.typeLabel')}
                    value={type}
                    disabled={busy}
                    onChange={setType}
                    options={RELATION_TYPES.map((value) => ({
                        value,
                        label: t(`taskDetail.relations.types.${value}`),
                    }))}
                />
                <div className="relative flex flex-1 flex-col gap-1.5">
                    <label htmlFor={searchId} className={FIELD_LABEL_CLASS}>
                        {t('taskDetail.relations.searchLabel')}
                    </label>
                    <input
                        id={searchId}
                        type="text"
                        role="combobox"
                        aria-expanded={menuOpen}
                        aria-controls={listId}
                        aria-autocomplete="list"
                        value={search}
                        disabled={busy}
                        placeholder={t('taskDetail.relations.searchPlaceholder')}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setTargetTaskId('');
                            setMenuOpen(true);
                        }}
                        onFocus={() => setMenuOpen(true)}
                        // A blur fires before the click on a suggestion lands, so the menu waits
                        // for the pointer rather than closing under it.
                        onBlur={() => window.setTimeout(() => setMenuOpen(false), 150)}
                        className={FIELD_CONTROL_CLASS}
                    />
                    {menuOpen && (
                        <ul
                            id={listId}
                            className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-ctm border border-line bg-panel"
                        >
                            {matches.length === 0 ? (
                                <li className="px-3 py-2 text-xs text-muted">
                                    {t('taskDetail.relations.noMatches')}
                                </li>
                            ) : (
                                matches.map((candidate) => (
                                    <li key={candidate.id}>
                                        <button
                                            type="button"
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                setTargetTaskId(candidate.id);
                                                setSearch(candidate.title);
                                                setMenuOpen(false);
                                            }}
                                            className="min-h-11 w-full truncate px-3 py-2 text-left text-sm text-fg hover:bg-nav-on-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:min-h-0"
                                        >
                                            {candidate.title}
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                    )}
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    disabled={!targetTaskId || busy}
                    onClick={() => addMutation.mutate({ type, targetTaskId })}
                    className={FIELD_HEIGHT_CLASS}
                >
                    {t('taskDetail.relations.add')}
                </Button>
            </div>
        </DetailSection>
    );
}

/** The tasks a relation can point at: anything but this one, narrowed by what has been typed. */
function matchTasks({ tasks, excludeId, term }: { tasks: TaskDto[]; excludeId: string; term: string }): TaskDto[] {
    const query = term.trim().toLowerCase();

    return tasks
        .filter((task) => task.id !== excludeId)
        .filter((task) => query === '' || task.title.toLowerCase().includes(query))
        .slice(0, MAX_SUGGESTIONS);
}
