import type { TaskDto } from '@ctm/api-client';
import { TaskCard } from './TaskCard.js';
import { bucketTasks, type TaskBuckets } from '../../lib/bucket-tasks.js';

type GroupedTaskListProps = {
    tasks: TaskDto[];
    highlightedTaskId?: string | null;
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
};

type SectionDef = {
    key: keyof TaskBuckets;
    label: string;
    chipClass: string;
};

const SECTIONS: SectionDef[] = [
    {
        key: 'overdue',
        label: '🔥 Overdue',
        chipClass: 'border-red-600 bg-red-200 shadow-[2px_2px_0px_#dc2626] text-red-700',
    },
    {
        key: 'today',
        label: 'Today',
        chipClass: 'border-blue-700 bg-blue-200 shadow-[2px_2px_0px_#1d4ed8] text-blue-800',
    },
    {
        key: 'thisWeek',
        label: 'This Week',
        chipClass:
            'border-nb-black bg-white shadow-[2px_2px_0px_#111] text-nb-black dark:border-white/20 dark:bg-neutral-800 dark:text-white dark:shadow-none',
    },
    {
        key: 'upcoming',
        label: 'Upcoming',
        chipClass:
            'border-nb-black bg-white shadow-[2px_2px_0px_#111] text-nb-black dark:border-white/20 dark:bg-neutral-800 dark:text-white dark:shadow-none',
    },
    {
        key: 'noDate',
        label: 'No Date',
        chipClass:
            'border-gray-400 bg-gray-100 shadow-[2px_2px_0px_#9ca3af] text-gray-500 dark:border-white/20 dark:bg-neutral-800 dark:text-white/50 dark:shadow-none',
    },
    {
        key: 'done',
        label: 'Done',
        chipClass:
            'border-gray-400 bg-gray-100 shadow-[2px_2px_0px_#9ca3af] text-gray-400 line-through dark:border-white/20 dark:bg-neutral-800 dark:text-white/30 dark:shadow-none',
    },
];

/** Renders tasks grouped into due-date sections with neobrutalist chip headers. */
export function GroupedTaskList({
    tasks,
    highlightedTaskId,
    onToggle,
    onEdit,
}: GroupedTaskListProps): React.JSX.Element {
    const buckets = bucketTasks(tasks);
    const isEmpty = Object.values(buckets).every((arr) => arr.length === 0);

    if (isEmpty) {
        return (
            <div className="bg-nb-yellow border-2 border-nb-black shadow-[3px_3px_0px_#111] p-6 text-center">
                <p className="font-black uppercase text-nb-black text-lg">No Tasks Here.</p>
                <p className="font-bold text-nb-black/60 text-sm mt-1">Add one above or change the filter.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {SECTIONS.map(({ key, label, chipClass }) => {
                const sectionTasks = buckets[key];

                if (sectionTasks.length === 0) return null;

                return (
                    <div key={key}>
                        <div
                            className={`inline-flex items-center gap-2 mb-2 border-2 px-2.5 py-0.5 font-black text-[11px] uppercase tracking-wide ${chipClass}`}
                        >
                            {label}
                            <span className="opacity-60 text-[10px]">{sectionTasks.length}</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            {sectionTasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    highlighted={task.id === highlightedTaskId}
                                    onToggle={onToggle}
                                    onEdit={onEdit}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
