import { useState, useEffect, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/error-message.js';
import { Modal, Button, Input } from '../ui/index.js';
import type { TaskDto, UpdateTaskDto } from '@ctm/api-client';

interface TaskModalProps {
    task: TaskDto | null;
    open: boolean;
    onClose: () => void;
    onSave: (id: string, dto: UpdateTaskDto) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    isSaving?: boolean;
    isDeleting?: boolean;
}

/** Modal for editing an existing task's details. */
export function TaskModal({
    task,
    open,
    onClose,
    onSave,
    onDelete,
    isSaving = false,
    isDeleting = false,
}: TaskModalProps): React.JSX.Element | null {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<1 | 2 | 3 | 4>(2);
    const [dueDate, setDueDate] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description ?? '');
            setPriority((task.priority ?? 2) as 1 | 2 | 3 | 4);
            setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
            setConfirmDelete(false);
            setErrorMessage('');
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

    const busy = isSaving || isDeleting;

    return (
        <Modal open={open} onClose={onClose} title="Edit Task">
            <form onSubmit={handleSave} className="flex flex-col gap-4">
                <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
                {errorMessage && <p className="text-nb-red font-bold text-sm">{errorMessage}</p>}
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
