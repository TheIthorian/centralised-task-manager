import { useState, useEffect, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/error-message.js';
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
    onRemoveFuzzyDeadline,
    isSaving = false,
    isDeleting = false,
    isSettingFuzzy = false,
    isRemovingFuzzy = false,
}: TaskModalProps): React.JSX.Element | null {
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
            await onSave(task.id, {
                title,
                description: description || undefined,
                priority,
                dueDate: dueDate || undefined,
            });
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

    const handleSetFuzzy = async (): Promise<void> => {
        setErrorMessage('');

        try {
            await onSetFuzzyDeadline(task.id, {
                type: fuzzyType,
                remindEvery: fuzzyRemindEvery || undefined,
            });
        } catch (error) {
            setErrorMessage(getErrorMessage(error, 'Failed to set fuzzy deadline.'));
        }
    };

    const handleRemoveFuzzy = async (): Promise<void> => {
        setErrorMessage('');

        try {
            await onRemoveFuzzyDeadline(task.id);
        } catch (error) {
            setErrorMessage(getErrorMessage(error, 'Failed to remove fuzzy deadline.'));
        }
    };

    const busy = isSaving || isDeleting || isSettingFuzzy || isRemovingFuzzy;

    return (
        <Modal open={open} onClose={onClose} title="Edit Task">
            <form onSubmit={handleSave} className="flex flex-col gap-4">
                <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
                <div>
                    <label className="font-black uppercase text-xs tracking-wide text-nb-black block mb-1">
                        Priority
                    </label>
                    <div className="flex gap-2">
                        {([1, 2, 3, 4] as const).map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPriority(p)}
                                className={`border-2 border-nb-black px-3 py-1 font-black text-xs ${
                                    priority === p ? 'bg-nb-black text-white' : 'bg-white text-nb-black'
                                }`}
                            >
                                P{p}
                            </button>
                        ))}
                    </div>
                </div>
                <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                {errorMessage && <p className="text-nb-red font-bold text-sm">{errorMessage}</p>}
                <div className="flex gap-2 mt-2">
                    <Button type="submit" disabled={busy}>
                        {isSaving ? 'Saving…' : 'Save'}
                    </Button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="font-black uppercase text-xs text-nb-black underline"
                    >
                        Cancel
                    </button>
                </div>
            </form>

            {/* Fuzzy Deadline */}
            <div className="mt-6 pt-4 border-t-2 border-nb-black">
                <p className="font-black uppercase text-xs tracking-wide text-nb-black mb-2">Fuzzy Deadline</p>
                {task.fuzzyDeadline && (
                    <p className="text-nb-black/60 font-bold text-xs mb-2">
                        Current: {FUZZY_TYPE_LABELS[task.fuzzyDeadline.type]}
                        {task.fuzzyDeadline.remindEvery ? ` · remind ${task.fuzzyDeadline.remindEvery}` : ''}
                    </p>
                )}
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2 items-center">
                        <select
                            value={fuzzyType}
                            onChange={(e) => setFuzzyType(e.target.value as FuzzyDeadlineInfo['type'])}
                            className="border-2 border-nb-black font-bold text-xs px-2 py-1 bg-white"
                            disabled={busy}
                        >
                            <option value="this_week">This Week</option>
                            <option value="this_month">This Month</option>
                            <option value="someday">Someday</option>
                        </select>
                        <select
                            value={fuzzyRemindEvery}
                            onChange={(e) => setFuzzyRemindEvery(e.target.value as 'daily' | 'weekly' | '')}
                            className="border-2 border-nb-black font-bold text-xs px-2 py-1 bg-white"
                            disabled={busy}
                        >
                            <option value="">No reminder</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" onClick={handleSetFuzzy} disabled={busy}>
                            {isSettingFuzzy ? 'Setting…' : 'Set Fuzzy'}
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            onClick={handleRemoveFuzzy}
                            disabled={busy || !task.fuzzyDeadline}
                        >
                            {isRemovingFuzzy ? 'Removing…' : 'Remove'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Delete */}
            <div className="mt-6 pt-4 border-t-2 border-nb-black">
                <Button variant="danger" onClick={handleDelete} disabled={busy} className="w-full">
                    {isDeleting ? 'Deleting…' : confirmDelete ? 'Confirm Delete?' : 'Delete Task'}
                </Button>
                {confirmDelete && (
                    <p className="text-xs font-bold text-nb-red mt-1">Click again to confirm permanent deletion.</p>
                )}
            </div>
        </Modal>
    );
}
