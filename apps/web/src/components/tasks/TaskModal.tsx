import { useState, useEffect, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/error-message.js';
import { useToast } from '../../toast/ToastContext.js';
import { Modal, Button, Input } from '../ui/index.js';
import type { FuzzyDeadlineInfo, SetFuzzyDeadlineDto, TaskDto, UpdateTaskDto } from '@ctm/api-client';

type TaskModalProps = {
    task: TaskDto | null;
    open: boolean;
    onClose: () => void;
    onSave: (id: string, dto: UpdateTaskDto) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onSetFuzzyDeadline: (id: string, dto: SetFuzzyDeadlineDto) => Promise<void>;
    onRemoveFuzzyDeadline: (id: string) => Promise<void>;
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
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [fuzzyType, setFuzzyType] = useState<FuzzyDeadlineInfo['type']>('this_week');
    const [fuzzyRemindEvery, setFuzzyRemindEvery] = useState<'daily' | 'weekly' | ''>('');

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description ?? '');
            setPriority((task.priority ?? 2) as 1 | 2 | 3 | 4);
            setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
            setConfirmDelete(false);
            setErrorMessage('');
            setFuzzyType(task.fuzzyDeadline?.type ?? 'this_week');
            setFuzzyRemindEvery(task.fuzzyDeadline?.remindEvery ?? '');
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
                    dueDate: dueDate || undefined,
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
                        <Input
                            label="Due Date"
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                        />
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
