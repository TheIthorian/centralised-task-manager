import { useState, useEffect, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/error-message.js';
import { useToast } from '../../toast/ToastContext.js';
import { Modal, Button, Input } from '../ui/index.js';
import type { FuzzyDeadlineInfo, LocationDto, SetFuzzyDeadlineDto, TaskDto, UpdateTaskDto } from '@ctm/api-client';

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

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description ?? '');
            setPriority((task.priority ?? 2) as 1 | 2 | 3 | 4);
            setDueDate(task.due?.date ? task.due.date.slice(0, 10) : '');
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
        }
    }, [task]);

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
        <Modal open={open} onClose={onClose} title="Edit Task">
            <div className="overflow-y-auto max-h-[70vh] flex flex-col gap-6 pr-1">
                <form onSubmit={handleSave} className="flex flex-col gap-4">
                    <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="description"
                            className="font-black uppercase text-xs tracking-wide text-nb-black dark:text-white"
                        >
                            Description
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full h-32 border-2 border-nb-black dark:border-white/20 bg-white dark:bg-neutral-800 font-bold p-2 text-nb-black dark:text-white resize-none overflow-y-auto focus:outline-none focus:shadow-[3px_3px_0px_#111] dark:focus:shadow-none placeholder:text-nb-grey placeholder:font-bold"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="font-black uppercase text-xs tracking-wide text-nb-black dark:text-white block mb-1">
                                Priority
                            </label>
                            <div className="flex gap-1">
                                {([1, 2, 3, 4] as const).map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPriority(p)}
                                        className={`border-2 border-nb-black dark:border-white/30 px-2 py-1 font-black text-xs ${
                                            priority === p
                                                ? 'bg-nb-black dark:bg-white text-white dark:text-nb-black'
                                                : 'bg-white dark:bg-neutral-800 text-nb-black dark:text-white'
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
                            type="date"
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
                            <label className="font-black uppercase text-xs tracking-wide text-nb-black dark:text-white">
                                Recurrence
                            </label>
                            <select
                                value={dueRecurrence}
                                onChange={(e) => setDueRecurrence(e.target.value)}
                                className="border-2 border-nb-black dark:border-white/20 font-bold text-xs px-2 py-1 bg-white dark:bg-neutral-800 text-nb-black dark:text-white"
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
                            <label className="font-black uppercase text-xs tracking-wide text-nb-black dark:text-white">
                                Duration
                            </label>
                            <div className="flex gap-1">
                                <input
                                    type="number"
                                    min={1}
                                    value={durationAmount}
                                    onChange={(e) => setDurationAmount(e.target.value)}
                                    placeholder="Amount"
                                    className="border-2 border-nb-black dark:border-white/20 font-bold text-xs px-2 py-1 bg-white dark:bg-neutral-800 text-nb-black dark:text-white w-20"
                                    disabled={busy}
                                />
                                <select
                                    value={durationUnit}
                                    onChange={(e) => setDurationUnit(e.target.value as 'minute' | 'day')}
                                    className="border-2 border-nb-black dark:border-white/20 font-bold text-xs px-2 py-1 bg-white dark:bg-neutral-800 text-nb-black dark:text-white"
                                    disabled={busy}
                                >
                                    <option value="minute">min</option>
                                    <option value="day">day</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Fuzzy Deadline */}
                    <div className="border-t-2 border-nb-black/20 dark:border-white/10 pt-3">
                        <p className="font-black uppercase text-xs tracking-widest text-nb-black/40 dark:text-white/30 mb-2">
                            Fuzzy Deadline
                        </p>
                        {task.fuzzyDeadline && (
                            <p className="text-nb-black/60 dark:text-white/50 font-bold text-xs mb-2">
                                Current: {FUZZY_TYPE_LABELS[task.fuzzyDeadline.type]}
                                {task.fuzzyDeadline.remindEvery ? ` · remind ${task.fuzzyDeadline.remindEvery}` : ''}
                            </p>
                        )}
                        <div className="flex gap-2 items-center flex-wrap">
                            <select
                                value={fuzzyType}
                                onChange={(e) => setFuzzyType(e.target.value as FuzzyDeadlineInfo['type'])}
                                className="border-2 border-nb-black dark:border-white/20 font-bold text-xs px-2 py-1 bg-white dark:bg-neutral-800 text-nb-black dark:text-white"
                                disabled={busy}
                            >
                                <option value="this_week">This Week</option>
                                <option value="this_month">This Month</option>
                                <option value="someday">Someday</option>
                            </select>
                            <select
                                value={fuzzyRemindEvery}
                                onChange={(e) => setFuzzyRemindEvery(e.target.value as 'daily' | 'weekly' | '')}
                                className="border-2 border-nb-black dark:border-white/20 font-bold text-xs px-2 py-1 bg-white dark:bg-neutral-800 text-nb-black dark:text-white"
                                disabled={busy}
                            >
                                <option value="">No reminder</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>
                        </div>
                    </div>

                    {/* Locations */}
                    <div className="border-t-2 border-nb-black/20 dark:border-white/10 pt-3">
                        <p className="font-black uppercase text-xs tracking-widest text-nb-black/40 dark:text-white/30 mb-2">
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
                                            className="text-nb-black dark:text-white underline truncate flex-1"
                                        >
                                            📍 {loc.name}
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => setLocations((prev) => prev.filter((_, j) => j !== i))}
                                            className="text-nb-red font-black text-xs hover:underline flex-shrink-0"
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
                                className="border-2 border-nb-black dark:border-white/30 px-2 py-1 font-black text-xs bg-white dark:bg-neutral-800 text-nb-black dark:text-white disabled:opacity-40 self-end"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    {errorMessage && <p className="text-nb-red font-bold text-sm">{errorMessage}</p>}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t-2 border-nb-black/10 dark:border-white/10">
                        <Button type="submit" disabled={busy}>
                            {isSaving ? 'Saving…' : 'Save'}
                        </Button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="font-black uppercase text-xs text-nb-black dark:text-white underline"
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
                        <p className="text-xs font-bold text-nb-red -mt-2">
                            Click again to confirm permanent deletion.
                        </p>
                    )}
                </form>
            </div>
        </Modal>
    );
}
