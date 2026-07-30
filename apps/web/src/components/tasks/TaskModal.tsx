import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getErrorMessage } from '../../api/error-message.js';
import { useToast } from '../../toast/ToastContext.js';
import { useAuth } from '../../auth/AuthContext.js';
import { Modal, Button, Input } from '@ctm/ui';
import type {
    FuzzyDeadlineInfo,
    LocationDto,
    RelationType,
    ReminderDto,
    SetFuzzyDeadlineDto,
    TaskDto,
    TaskRelationDto,
    UpdateTaskDto,
} from '@ctm/api-client';

type TaskModalProps = {
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

const FUZZY_TYPE_LABELS: Record<FuzzyDeadlineInfo['type'], string> = {
    this_week: 'This Week',
    this_month: 'This Month',
    someday: 'Someday',
};

const RELATION_TYPE_LABELS: Record<RelationType, string> = {
    parent: 'Parent',
    child: 'Child',
    next: 'Next',
    previous: 'Previous',
    related: 'Related',
};

const RELATION_TYPES = Object.keys(RELATION_TYPE_LABELS) as RelationType[];

/** Modal for editing an existing task's details. */
export function TaskModal({
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
}: TaskModalProps): React.JSX.Element | null {
    const { showToast } = useToast();
    const { api } = useAuth();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<1 | 2 | 3 | 4>(2);
    const [dueDate, setDueDate] = useState('');
    const [dueRecurrence, setDueRecurrence] = useState('');
    const [deadlineDate, setDeadlineDate] = useState('');
    const [durationAmount, setDurationAmount] = useState('');
    const [durationUnit, setDurationUnit] = useState<'minute' | 'day'>('minute');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [fuzzyType, setFuzzyType] = useState<FuzzyDeadlineInfo['type']>('this_week');
    const [fuzzyRemindEvery, setFuzzyRemindEvery] = useState<'daily' | 'weekly' | ''>('');
    const [locations, setLocations] = useState<LocationDto[]>([]);
    const [newLocName, setNewLocName] = useState('');
    const [newLocUrl, setNewLocUrl] = useState('');
    const [reminders, setReminders] = useState<{ remindAt: string; firedAt: string | null }[]>([]);
    const [newRemindAt, setNewRemindAt] = useState('');
    const [relations, setRelations] = useState<TaskRelationDto[]>([]);
    const [newRelationType, setNewRelationType] = useState<RelationType>('related');
    const [newRelationTarget, setNewRelationTarget] = useState('');
    const [relationSearch, setRelationSearch] = useState('');
    const [relationMenuOpen, setRelationMenuOpen] = useState(false);

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description ?? '');
            setPriority((task.priority ?? 2) as 1 | 2 | 3 | 4);
            setDueDate(task.due?.date ? task.due.date.slice(0, 16) : '');
            setDueRecurrence(task.due?.recurrence ?? '');
            setDeadlineDate(task.deadlineDate ? task.deadlineDate.slice(0, 10) : '');
            setDurationAmount(task.duration ? String(task.duration.amount) : '');
            setDurationUnit(task.duration?.unit ?? 'minute');
            setConfirmDelete(false);
            setErrorMessage('');
            setFuzzyType(task.fuzzyDeadline?.type ?? 'this_week');
            setFuzzyRemindEvery(task.fuzzyDeadline?.remindEvery ?? '');
            setLocations(task.locations ?? []);
            setNewLocName('');
            setNewLocUrl('');
            setReminders(task.reminders ?? []);
            setNewRemindAt('');
            setRelations(task.relations ?? []);
            setNewRelationType('related');
            setNewRelationTarget('');
            setRelationSearch('');
            setRelationMenuOpen(false);
        }
    }, [task]);

    // Load the task list to resolve relation target titles and populate the target picker.
    const { data: allTasks = [] } = useQuery<TaskDto[]>({
        queryKey: ['tasks', 'relation-picker'],
        queryFn: () => api.listTasks({ filter: 'all' }),
        enabled: open && task !== null,
    });

    const titleById = new Map(allTasks.map((t) => [t.id, t.title]));

    const addReminderMutation = useMutation({
        mutationFn: (remindAt: string) => {
            if (!task) return Promise.reject(new Error('No task'));

            return api.addReminder({ id: task.id, dto: { remindAt } });
        },
        onSuccess: (added: ReminderDto) => {
            setReminders((prev) => [...prev, added]);
            setNewRemindAt('');
        },
    });

    const removeReminderMutation = useMutation({
        mutationFn: (index: number) => {
            if (!task) return Promise.reject(new Error('No task'));

            return api.removeReminder({ id: task.id, index });
        },
        onSuccess: (_data: unknown, index: number) => {
            setReminders((prev) => prev.filter((_, i) => i !== index));
        },
    });

    const addRelationMutation = useMutation({
        mutationFn: (dto: TaskRelationDto) => {
            if (!task) return Promise.reject(new Error('No task'));

            return api.addRelation({ id: task.id, dto });
        },
        onSuccess: (updated: TaskDto) => {
            setRelations(updated.relations);
            setNewRelationTarget('');
            setRelationSearch('');
            setRelationMenuOpen(false);
        },
    });

    const removeRelationMutation = useMutation({
        mutationFn: (dto: TaskRelationDto) => {
            if (!task) return Promise.reject(new Error('No task'));

            return api.removeRelation({ id: task.id, dto });
        },
        onSuccess: (updated: TaskDto) => {
            setRelations(updated.relations);
        },
    });

    if (!task) return null;

    const handleSave = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        setErrorMessage('');

        try {
            await Promise.all([
                onSave(task.id, {
                    title,
                    description: description || undefined,
                    priority,
                    due: dueDate ? { date: dueDate, recurrence: dueRecurrence || undefined } : undefined,
                    deadlineDate: deadlineDate || undefined,
                    duration: durationAmount ? { amount: Number(durationAmount), unit: durationUnit } : undefined,
                    locations,
                }),
                onSetFuzzyDeadline(task.id, {
                    type: fuzzyType,
                    remindEvery: fuzzyRemindEvery || undefined,
                }),
            ]);
            showToast({ title: 'Success', description: 'Task saved successfully.' });
            onClose();
        } catch (error) {
            setErrorMessage(getErrorMessage(error, 'Failed to save task.'));
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
            setErrorMessage(getErrorMessage(error, 'Failed to delete task.'));
        }
    };

    const busy = isSaving || isDeleting || isSettingFuzzy || isRemovingFuzzy;

    return (
        <Modal open={open} onClose={onClose} title="Edit Task" widthClassName="md:max-w-2xl">
            <div className="overflow-y-auto max-h-[70vh] flex flex-col gap-6 pr-1">
                <form onSubmit={handleSave} className="flex flex-col gap-4">
                    <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="description"
                            className="font-semibold text-xs tracking-wide text-fg"
                        >
                            Description
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full h-32 border border-line bg-panel p-2 text-fg resize-none overflow-y-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent placeholder:text-muted"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="font-semibold text-xs tracking-wide text-fg block mb-1">
                                Priority
                            </label>
                            <div className="flex gap-1">
                                {([1, 2, 3, 4] as const).map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPriority(p)}
                                        className={`border border-line px-2 py-1 font-semibold text-xs ${
                                            priority === p
                                                ? 'bg-accent text-accent-fg'
                                                : 'bg-panel text-fg'
                                        }`}
                                    >
                                        P{p}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Due Date"
                            type="datetime-local"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                        />
                        <Input
                            label="Deadline"
                            type="date"
                            value={deadlineDate}
                            onChange={(e) => setDeadlineDate(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="font-semibold text-xs tracking-wide text-fg">
                                Recurrence
                            </label>
                            <select
                                value={dueRecurrence}
                                onChange={(e) => setDueRecurrence(e.target.value)}
                                className="border border-line font-bold text-xs px-2 py-1 bg-panel text-fg"
                                disabled={busy}
                            >
                                <option value="">None</option>
                                <option value="FREQ=DAILY">Daily</option>
                                <option value="FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR">Every weekday</option>
                                <option value="FREQ=WEEKLY">Weekly</option>
                                <option value="FREQ=MONTHLY">Monthly</option>
                                <option value="FREQ=YEARLY">Yearly</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="font-semibold text-xs tracking-wide text-fg">
                                Duration
                            </label>
                            <div className="flex gap-1">
                                <input
                                    type="number"
                                    min={1}
                                    value={durationAmount}
                                    onChange={(e) => setDurationAmount(e.target.value)}
                                    placeholder="Amount"
                                    className="border border-line font-bold text-xs px-2 py-1 bg-panel text-fg w-20"
                                    disabled={busy}
                                />
                                <select
                                    value={durationUnit}
                                    onChange={(e) => setDurationUnit(e.target.value as 'minute' | 'day')}
                                    className="border border-line font-bold text-xs px-2 py-1 bg-panel text-fg"
                                    disabled={busy}
                                >
                                    <option value="minute">min</option>
                                    <option value="day">day</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Reminders */}
                    <div className="flex flex-col gap-2">
                        <label className="font-semibold text-xs tracking-wide text-fg">
                            Reminders
                        </label>
                        {reminders.length > 0 && (
                            <ul className="flex flex-col gap-1">
                                {reminders.map((r, i) => (
                                    <li key={i} className="flex items-center justify-between gap-2">
                                        <span
                                            className={`text-xs font-bold ${r.firedAt ? 'text-muted line-through' : 'text-fg'}`}
                                        >
                                            {new Date(r.remindAt).toLocaleString()}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeReminderMutation.mutate(i)}
                                            disabled={busy}
                                            className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-40"
                                        >
                                            ×
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="flex gap-2">
                            <input
                                type="datetime-local"
                                value={newRemindAt}
                                onChange={(e) => setNewRemindAt(e.target.value)}
                                disabled={busy}
                                className="border border-line font-bold text-xs px-2 py-1 bg-panel text-fg flex-1"
                            />
                            <button
                                type="button"
                                disabled={!newRemindAt || busy}
                                onClick={() => addReminderMutation.mutate(new Date(newRemindAt).toISOString())}
                                className="border border-line font-semibold text-xs px-3 py-1 bg-panel text-fg disabled:opacity-40"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Relations */}
                    <div className="border-t border-line/20 pt-3">
                        <p className="font-semibold text-xs tracking-widest text-muted mb-2">
                            Relations
                        </p>
                        {relations.length > 0 && (
                            <ul className="flex flex-col gap-1 mb-2">
                                {relations.map((rel) => (
                                    <li
                                        key={`${rel.type}:${rel.targetTaskId}`}
                                        className="flex items-center gap-2 text-xs font-bold"
                                    >
                                        <span className="border border-line px-1.5 py-0.5 uppercase text-[10px] tracking-wide text-fg">
                                            {RELATION_TYPE_LABELS[rel.type]}
                                        </span>
                                        <span className="text-fg truncate flex-1">
                                            {titleById.get(rel.targetTaskId) ?? rel.targetTaskId}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeRelationMutation.mutate(rel)}
                                            disabled={busy || removeRelationMutation.isPending}
                                            className="text-warn font-semibold text-xs hover:underline flex-shrink-0 disabled:opacity-40"
                                        >
                                            Remove
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="flex gap-2">
                            <select
                                value={newRelationType}
                                onChange={(e) => setNewRelationType(e.target.value as RelationType)}
                                disabled={busy || addRelationMutation.isPending}
                                className="border border-line font-bold text-xs px-2 py-1 bg-panel text-fg"
                            >
                                {RELATION_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                        {RELATION_TYPE_LABELS[t]}
                                    </option>
                                ))}
                            </select>
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={relationSearch}
                                    placeholder="Search a task…"
                                    disabled={busy || addRelationMutation.isPending}
                                    onChange={(e) => {
                                        setRelationSearch(e.target.value);
                                        setNewRelationTarget('');
                                        setRelationMenuOpen(true);
                                    }}
                                    onFocus={() => setRelationMenuOpen(true)}
                                    onBlur={() => setTimeout(() => setRelationMenuOpen(false), 150)}
                                    className="w-full border border-line font-bold text-xs px-2 py-1 bg-panel text-fg"
                                />
                                {relationMenuOpen &&
                                    (() => {
                                        const q = relationSearch.trim().toLowerCase();
                                        const matches = allTasks
                                            .filter((t) => t.id !== task.id)
                                            .filter((t) => q === '' || t.title.toLowerCase().includes(q))
                                            .slice(0, 8);

                                        return (
                                            <ul className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto border border-line bg-panel">
                                                {matches.length === 0 ? (
                                                    <li className="px-2 py-1 text-xs font-bold text-muted">
                                                        No matches
                                                    </li>
                                                ) : (
                                                    matches.map((t) => (
                                                        <li key={t.id}>
                                                            <button
                                                                type="button"
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    setNewRelationTarget(t.id);
                                                                    setRelationSearch(t.title);
                                                                    setRelationMenuOpen(false);
                                                                }}
                                                                className="w-full text-left px-2 py-1 text-xs font-bold text-fg hover:bg-fg hover:text-white dark:hover:bg-white/20 truncate"
                                                            >
                                                                {t.title}
                                                            </button>
                                                        </li>
                                                    ))
                                                )}
                                            </ul>
                                        );
                                    })()}
                            </div>
                            <button
                                type="button"
                                disabled={!newRelationTarget || busy || addRelationMutation.isPending}
                                onClick={() =>
                                    addRelationMutation.mutate({
                                        type: newRelationType,
                                        targetTaskId: newRelationTarget,
                                    })
                                }
                                className="border border-line px-3 py-1 font-semibold text-xs bg-panel text-fg disabled:opacity-40"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Fuzzy Deadline */}
                    <div className="border-t border-line/20 pt-3">
                        <p className="font-semibold text-xs tracking-widest text-muted mb-2">
                            Fuzzy Deadline
                        </p>
                        {task.fuzzyDeadline && (
                            <p className="text-muted font-bold text-xs mb-2">
                                Current: {FUZZY_TYPE_LABELS[task.fuzzyDeadline.type]}
                                {task.fuzzyDeadline.remindEvery ? ` · remind ${task.fuzzyDeadline.remindEvery}` : ''}
                            </p>
                        )}
                        <div className="flex gap-2 items-center flex-wrap">
                            <select
                                value={fuzzyType}
                                onChange={(e) => setFuzzyType(e.target.value as FuzzyDeadlineInfo['type'])}
                                className="border border-line font-bold text-xs px-2 py-1 bg-panel text-fg"
                                disabled={busy}
                            >
                                <option value="this_week">This Week</option>
                                <option value="this_month">This Month</option>
                                <option value="someday">Someday</option>
                            </select>
                            <select
                                value={fuzzyRemindEvery}
                                onChange={(e) => setFuzzyRemindEvery(e.target.value as 'daily' | 'weekly' | '')}
                                className="border border-line font-bold text-xs px-2 py-1 bg-panel text-fg"
                                disabled={busy}
                            >
                                <option value="">No reminder</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>
                        </div>
                    </div>

                    {/* Locations */}
                    <div className="border-t border-line/20 pt-3">
                        <p className="font-semibold text-xs tracking-widest text-muted mb-2">
                            Locations
                        </p>
                        {locations.length > 0 && (
                            <ul className="flex flex-col gap-1 mb-2">
                                {locations.map((loc, i) => (
                                    <li key={i} className="flex items-center gap-2 text-xs font-bold">
                                        <a
                                            href={loc.googleMapsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-fg underline truncate flex-1"
                                        >
                                            📍 {loc.name}
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => setLocations((prev) => prev.filter((_, j) => j !== i))}
                                            className="text-warn font-semibold text-xs hover:underline flex-shrink-0"
                                            disabled={busy}
                                        >
                                            Remove
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="flex gap-2">
                            <Input
                                label=""
                                placeholder="Name"
                                value={newLocName}
                                onChange={(e) => setNewLocName(e.target.value)}
                            />
                            <Input
                                label=""
                                placeholder="Google Maps URL"
                                value={newLocUrl}
                                onChange={(e) => setNewLocUrl(e.target.value)}
                            />
                            <button
                                type="button"
                                disabled={!newLocName.trim() || !newLocUrl.trim() || busy}
                                onClick={() => {
                                    setLocations((prev) => [
                                        ...prev,
                                        { name: newLocName.trim(), googleMapsUrl: newLocUrl.trim() },
                                    ]);
                                    setNewLocName('');
                                    setNewLocUrl('');
                                }}
                                className="border border-line px-2 py-1 font-semibold text-xs bg-panel text-fg disabled:opacity-40 self-end"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    {errorMessage && <p className="text-warn font-bold text-sm">{errorMessage}</p>}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-line/10">
                        <Button type="submit" disabled={busy}>
                            {isSaving ? 'Saving…' : 'Save'}
                        </Button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="font-semibold text-xs text-fg underline"
                        >
                            Cancel
                        </button>
                        <div className="ml-auto">
                            <Button type="button" variant="danger" onClick={handleDelete} disabled={busy}>
                                {isDeleting ? 'Deleting…' : confirmDelete ? 'Confirm?' : 'Delete'}
                            </Button>
                        </div>
                    </div>
                    {confirmDelete && (
                        <p className="text-xs font-bold text-warn -mt-2">
                            Click again to confirm permanent deletion.
                        </p>
                    )}
                </form>
            </div>
        </Modal>
    );
}
