import { useState, type FormEvent } from 'react';
import { Button, Input } from '../ui/index.js';
import type { CreateTaskDto } from '@ctm/api-client';

type AddTaskInlineProps = {
    onAdd: (dto: CreateTaskDto) => Promise<void>;
    isPending?: boolean;
};

/** Expandable inline form for quickly adding a task. */
export function AddTaskInline({ onAdd, isPending = false }: AddTaskInlineProps): React.JSX.Element {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<1 | 2 | 3>(2);
    const [dueDate, setDueDate] = useState('');

    const handleSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault();

        if (!title.trim()) return;

        await onAdd({
            title: title.trim(),
            priority,
            source: 'local',
            description: description.trim() || undefined,
            due: dueDate ? { date: dueDate } : undefined,
        });

        setTitle('');
        setDescription('');
        setPriority(2);
        setDueDate('');
        setOpen(false);
    };

    if (!open) {
        return (
            <Button variant="danger" onClick={() => setOpen(true)}>
                ＋ Add Task
            </Button>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-neutral-900 border-2 border-nb-black dark:border-white/20 shadow-[3px_3px_0px_#111] dark:shadow-none p-4 flex flex-col gap-3"
        >
            <Input
                label="Task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs doing?"
                autoFocus
                required
            />
            <Input
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="More detail…"
            />
            <div className="flex items-center gap-2">
                <label className="font-black uppercase text-xs tracking-wide text-nb-black dark:text-white">Priority:</label>
                {([1, 2, 3] as const).map((p) => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`border-2 border-nb-black dark:border-white/30 px-2 py-0.5 font-black text-xs cursor-pointer ${
                            priority === p ? 'bg-nb-black dark:bg-white text-white dark:text-nb-black' : 'bg-white dark:bg-neutral-800 text-nb-black dark:text-white'
                        }`}
                    >
                        P{p}
                    </button>
                ))}
            </div>
            <Input
                label="Due date (optional)"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
            />
            <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                    {isPending ? 'Adding…' : 'Add'}
                </Button>
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="font-black uppercase text-xs text-nb-black dark:text-white underline cursor-pointer"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
