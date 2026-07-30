import { useState, type FormEvent } from 'react';
import { Button, Input } from '@ctm/ui';
import type { CreateTaskDto } from '@ctm/api-client';
import { useTranslation } from 'react-i18next';
import { DATE_FIELD_CLASS } from './detail/DetailSection.js';

type AddTaskInlineProps = {
    onAdd: (dto: CreateTaskDto) => Promise<void>;
    isPending?: boolean;
    /** Owned by the page, because the control that opens the form lives in the filter row. */
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

/** Inline form for quickly adding a task. Its trigger sits in the filter row. */
export function AddTaskInline({ onAdd, isPending = false, open, onOpenChange }: AddTaskInlineProps): React.JSX.Element | null {
    const { t } = useTranslation();
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
        onOpenChange(false);
    };

    if (!open) return null;

    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 rounded-ctm border border-line bg-panel p-4"
        >
            <Input
                label={t('tasks.titleLabel')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('tasks.titlePlaceholder')}
                autoFocus
                required
            />
            <Input
                label={t('tasks.descriptionLabel')}
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
                label={t('tasks.dueDateLabel')}
                type="datetime-local"
                className={DATE_FIELD_CLASS}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
            />
            <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                    {isPending ? t('tasks.adding') : t('tasks.add')}
                </Button>
                <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="cursor-pointer text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    {t('common.cancel')}
                </button>
            </div>
        </form>
    );
}
