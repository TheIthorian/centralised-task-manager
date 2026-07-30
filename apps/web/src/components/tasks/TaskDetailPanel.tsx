import { useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Input, SegmentedControl } from '@ctm/ui';
import type { LocationDto, SetFuzzyDeadlineDto, TaskDto, UpdateTaskDto } from '@ctm/api-client';
import { getErrorMessage } from '../../api/error-message.js';
import { useToast } from '../../toast/ToastContext.js';
import { useAuth } from '../../auth/AuthContext.js';
import { SourceBadge } from './SourceBadge.js';
import { DetailSection, FIELD_CONTROL_CLASS, FIELD_LABEL_CLASS } from './detail/DetailSection.js';
import { DetailSelect } from './detail/DetailSelect.js';
import { ReminderSection } from './detail/ReminderSection.js';
import { RelationSection } from './detail/RelationSection.js';
import { LocationSection } from './detail/LocationSection.js';
import {
    FuzzyDeadlineSection,
    type FuzzyCadence,
    type FuzzyType,
} from './detail/FuzzyDeadlineSection.js';
import { fieldOwnership } from './detail/field-ownership.js';

type TaskDetailPanelProps = {
    task: TaskDto | null;
    open: boolean;
    onClose: () => void;
    onSave: (id: string, dto: UpdateTaskDto) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onSetFuzzyDeadline: (id: string, dto: SetFuzzyDeadlineDto) => Promise<void>;
    isSaving?: boolean;
    isDeleting?: boolean;
    isSettingFuzzy?: boolean;
    isRemovingFuzzy?: boolean;
};

type Priority = 1 | 2 | 3 | 4;

type DurationUnit = 'minute' | 'day';

const PRIORITIES: Priority[] = [1, 2, 3, 4];

const DURATION_UNITS: DurationUnit[] = ['minute', 'day'];

const RECURRENCES = ['none', 'daily', 'weekday', 'weekly', 'monthly', 'yearly'] as const;

type Recurrence = (typeof RECURRENCES)[number];

const RECURRENCE_RULES: Record<Recurrence, string> = {
    none: '',
    daily: 'FREQ=DAILY',
    weekday: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    weekly: 'FREQ=WEEKLY',
    monthly: 'FREQ=MONTHLY',
    yearly: 'FREQ=YEARLY',
};

/** Detail panel for one task: a side sheet on desktop, a full screen sheet on a phone. */
export function TaskDetailPanel({
    task,
    open,
    onClose,
    onSave,
    onDelete,
    onSetFuzzyDeadline,
    isSaving = false,
    isDeleting = false,
    isSettingFuzzy = false,
    isRemovingFuzzy = false,
}: TaskDetailPanelProps): React.JSX.Element | null {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { api } = useAuth();
    const headingId = useId();
    const descriptionId = useId();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<Priority>(2);
    const [dueDate, setDueDate] = useState('');
    const [recurrence, setRecurrence] = useState<Recurrence>('none');
    const [deadlineDate, setDeadlineDate] = useState('');
    const [durationAmount, setDurationAmount] = useState('');
    const [durationUnit, setDurationUnit] = useState<DurationUnit>('minute');
    const [locations, setLocations] = useState<LocationDto[]>([]);
    const [fuzzyType, setFuzzyType] = useState<FuzzyType>('this_week');
    const [fuzzyCadence, setFuzzyCadence] = useState<FuzzyCadence>('none');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!task) return;

        setTitle(task.title);
        setDescription(task.description ?? '');
        setPriority(task.priority ?? 2);
        setDueDate(task.due?.date ? task.due.date.slice(0, 16) : '');
        setRecurrence(recurrenceOf(task.due?.recurrence ?? ''));
        setDeadlineDate(task.deadlineDate ? task.deadlineDate.slice(0, 10) : '');
        setDurationAmount(task.duration ? String(task.duration.amount) : '');
        setDurationUnit(task.duration?.unit ?? 'minute');
        setLocations(task.locations);
        setFuzzyType(task.fuzzyDeadline?.type ?? 'this_week');
        setFuzzyCadence(task.fuzzyDeadline?.remindEvery ?? 'none');
        setConfirmDelete(false);
        setErrorMessage('');
    }, [task]);

    useEffect(() => {
        if (!open) return;

        // Escape has to give the keyboard back to whatever opened the panel, otherwise focus
        // lands on the body and the next Tab restarts at the top of the page.
        const opener = document.activeElement;

        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('keydown', onKeyDown);

            if (opener instanceof HTMLElement) opener.focus();
        };
    }, [open, onClose]);

    // Relation targets are picked by title, so the picker needs the whole list rather than
    // the page of tasks the caller happens to be showing.
    const { data: candidates = [] } = useQuery<TaskDto[]>({
        queryKey: ['tasks', 'relation-picker'],
        queryFn: () => api.listTasks({ filter: 'all' }),
        enabled: open && task !== null,
    });

    if (!open || !task) return null;

    const busy = isSaving || isDeleting || isSettingFuzzy || isRemovingFuzzy;
    const ownership = fieldOwnership(task.source);
    const deleteLabel = isDeleting
        ? t('taskDetail.actions.deleting')
        : confirmDelete
          ? t('taskDetail.actions.confirmDelete')
          : t('taskDetail.actions.delete');

    const handleSave = async (event: FormEvent): Promise<void> => {
        event.preventDefault();
        setErrorMessage('');

        try {
            await Promise.all([
                onSave(task.id, {
                    title,
                    description: description || undefined,
                    priority,
                    due: dueDate ? { date: dueDate, recurrence: RECURRENCE_RULES[recurrence] || undefined } : undefined,
                    deadlineDate: deadlineDate || undefined,
                    duration: durationAmount ? { amount: Number(durationAmount), unit: durationUnit } : undefined,
                    locations,
                }),
                onSetFuzzyDeadline(task.id, {
                    type: fuzzyType,
                    remindEvery: fuzzyCadence === 'none' ? undefined : fuzzyCadence,
                }),
            ]);
            showToast({ title: t('taskDetail.saved.title'), description: t('taskDetail.saved.body') });
            onClose();
        } catch (error) {
            setErrorMessage(getErrorMessage(error, t('taskDetail.saveFailed.body')));
        }
    };

    const handleDelete = async (): Promise<void> => {
        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }

        setErrorMessage('');

        try {
            await onDelete(task.id);
            onClose();
        } catch (error) {
            setErrorMessage(getErrorMessage(error, t('taskDetail.deleteFailed.body')));
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-end">
            <div
                className="absolute inset-0 bg-fg/25 md:bg-fg/10 motion-safe:animate-[ctm-fade_var(--duration-surface)_ease-out]"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={headingId}
                className="relative z-10 flex h-full w-full flex-col bg-panel text-fg md:w-[460px] md:border-l md:border-line md:shadow-overlay motion-safe:animate-[ctm-slide-in_var(--duration-surface)_ease-out]"
            >
                <header className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-6">
                    <h2 id={headingId} className="flex-1 text-base font-semibold tracking-tight text-fg">
                        {t('taskDetail.title')}
                    </h2>
                    <SourceBadge source={task.source} />
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        aria-label={t('taskDetail.close')}
                        className="min-h-11 md:min-h-0"
                    >
                        <span aria-hidden="true">✕</span>
                    </Button>
                </header>

                <form onSubmit={handleSave} className="flex flex-1 flex-col overflow-y-auto">
                    <div className="flex flex-col gap-4 px-4 py-4 md:px-6">
                        <DetailSection title={t('taskDetail.sections.details')} ownership={ownership}>
                            <Input
                                label={t('taskDetail.fields.title')}
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                disabled={busy}
                                required
                                className="min-h-11 md:min-h-0"
                            />
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor={descriptionId} className={FIELD_LABEL_CLASS}>
                                    {t('taskDetail.fields.description')}
                                </label>
                                <textarea
                                    id={descriptionId}
                                    value={description}
                                    disabled={busy}
                                    onChange={(event) => setDescription(event.target.value)}
                                    className={`${FIELD_CONTROL_CLASS} h-32 resize-none`}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className={FIELD_LABEL_CLASS}>{t('taskDetail.fields.priority')}</span>
                                <SegmentedControl
                                    label={t('taskDetail.fields.priority')}
                                    value={String(priority)}
                                    onChange={(value) => setPriority(toPriority(value))}
                                    options={PRIORITIES.map((level) => ({
                                        value: String(level),
                                        label: t('taskDetail.fields.priorityOption', { level }),
                                    }))}
                                />
                            </div>
                        </DetailSection>

                        <DetailSection title={t('taskDetail.sections.schedule')} ownership={ownership}>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Input
                                    label={t('taskDetail.fields.dueDate')}
                                    type="datetime-local"
                                    value={dueDate}
                                    disabled={busy}
                                    onChange={(event) => setDueDate(event.target.value)}
                                    className="min-h-11 md:min-h-0"
                                />
                                <Input
                                    label={t('taskDetail.fields.deadline')}
                                    type="date"
                                    value={deadlineDate}
                                    disabled={busy}
                                    onChange={(event) => setDeadlineDate(event.target.value)}
                                    className="min-h-11 md:min-h-0"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <DetailSelect
                                    label={t('taskDetail.fields.recurrence')}
                                    value={recurrence}
                                    disabled={busy}
                                    onChange={setRecurrence}
                                    options={RECURRENCES.map((value) => ({
                                        value,
                                        label: t(`taskDetail.recurrences.${value}`),
                                    }))}
                                />
                                <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                        <Input
                                            label={t('taskDetail.fields.duration')}
                                            type="number"
                                            min={1}
                                            value={durationAmount}
                                            disabled={busy}
                                            placeholder={t('taskDetail.fields.durationPlaceholder')}
                                            onChange={(event) => setDurationAmount(event.target.value)}
                                            className="min-h-11 md:min-h-0"
                                        />
                                    </div>
                                    <DetailSelect
                                        label={t('taskDetail.fields.durationUnit')}
                                        value={durationUnit}
                                        disabled={busy}
                                        onChange={setDurationUnit}
                                        options={DURATION_UNITS.map((value) => ({
                                            value,
                                            label: t(`taskDetail.durationUnits.${value}`),
                                        }))}
                                    />
                                </div>
                            </div>
                        </DetailSection>

                        <ReminderSection
                            key={`reminders:${task.id}`}
                            taskId={task.id}
                            reminders={task.reminders}
                            ownership={ownership}
                            disabled={busy}
                        />

                        <RelationSection
                            key={`relations:${task.id}`}
                            taskId={task.id}
                            relations={task.relations}
                            candidates={candidates}
                            ownership={ownership}
                            disabled={busy}
                        />

                        <FuzzyDeadlineSection
                            current={task.fuzzyDeadline ?? null}
                            type={fuzzyType}
                            cadence={fuzzyCadence}
                            onTypeChange={setFuzzyType}
                            onCadenceChange={setFuzzyCadence}
                            ownership={ownership}
                            disabled={busy}
                        />

                        <LocationSection
                            locations={locations}
                            onChange={setLocations}
                            ownership={ownership}
                            disabled={busy}
                        />

                        {errorMessage && (
                            <Banner tone="warn" title={t('taskDetail.saveFailed.title')} body={errorMessage} />
                        )}
                    </div>

                    <div className="mt-auto flex items-center gap-2 border-t border-line px-4 py-3 md:px-6">
                        <Button type="submit" disabled={busy} className="min-h-11 md:min-h-0">
                            {isSaving ? t('taskDetail.actions.saving') : t('common.save')}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={busy}
                            className="min-h-11 md:min-h-0"
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            onClick={handleDelete}
                            disabled={busy}
                            className="ml-auto min-h-11 md:min-h-0"
                        >
                            {deleteLabel}
                        </Button>
                    </div>

                    {confirmDelete && (
                        <p role="status" className="px-4 pb-4 text-xs text-warn md:px-6">
                            {t('taskDetail.actions.confirmHint')}
                        </p>
                    )}
                </form>
            </div>
        </div>,
        document.body,
    );
}

/** Maps a stored recurrence rule back onto the option that produced it. */
function recurrenceOf(rule: string): Recurrence {
    return RECURRENCES.find((option) => RECURRENCE_RULES[option] === rule) ?? 'none';
}

/** Reads a priority back off the segmented control, which carries its value as a string. */
function toPriority(value: string): Priority {
    return PRIORITIES.find((level) => String(level) === value) ?? 2;
}

