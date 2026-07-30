import { useState, type FormEvent } from 'react';
import { Button, Input } from '@ctm/ui';
import type { CreateTaskDto } from '@ctm/api-client';
import { useTranslation } from 'react-i18next';
import { DATE_FIELD_CLASS } from './detail/DetailSection.js';

type AddTaskInlineProps = {
    onAdd: (dto: CreateTaskDto) => Promise<void>;
    isPending?: boolean;
};

/** Expandable inline form for quickly adding a task. */
export function AddTaskInline({ onAdd, isPending = false }: AddTaskInlineProps): React.JSX.Element {
    const { t } = useTranslation();
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
            <Button variant="secondary" onClick={() => setOpen(true)} className="self-start">
                {t('tasks.newTask')}
            </Button>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 rounded-ctm border border-line bg-panel p-4"
        >
            <Input
                label="Task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('tasks.titlePlaceholder')}
                autoFocus
                required
            />
            <Input
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('tasks.notesPlaceholder')}
            />
            <div className="flex items-center gap-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-muted">
                    {t('tasks.priorityLabel')}
                </label>
                {([1, 2, 3] as const).map((p) => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        aria-pressed={priority === p}
                        className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] transition-colors duration-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                            priority === p ? 'border-accent bg-accent text-accent-fg rounded-ctm' : 'border-line bg-panel text-muted rounded-ctm'
                        }`}
                    >
                        P{p}
                    </button>
                ))}
            </div>
            <Input
                label="Due date (optional)"
                type="datetime-local"
                className={DATE_FIELD_CLASS}
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
                    className="cursor-pointer text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    {t('common.cancel')}
                </button>
            </div>
        </form>
    );
}
