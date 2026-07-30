import type { TaskDto } from '@ctm/api-client';

export type DueCondition = 'overdue' | 'today' | 'week' | 'none';
export type FieldCondition = 'noDate' | 'noDuration' | 'hasReminder';

/** One thing the user has asked to be true of every task on screen. */
export type Condition =
    | { kind: 'due'; value: DueCondition }
    | { kind: 'field'; value: FieldCondition }
    | { kind: 'source'; value: string };

export const DUE_CONDITIONS: DueCondition[] = ['overdue', 'today', 'week', 'none'];
export const FIELD_CONDITIONS: FieldCondition[] = ['noDate', 'noDuration', 'hasReminder'];

/** Query keys the conditions live under, so a filtered list is a shareable URL. */
const PARAM_BY_KIND = { due: 'due', field: 'field', source: 'source' } as const;

const DUE_VALUES = new Set<string>(DUE_CONDITIONS);
const FIELD_VALUES = new Set<string>(FIELD_CONDITIONS);

/** Reads the conditions out of a URL. Values it does not recognise are dropped, not thrown. */
export function parseConditions(params: URLSearchParams): Condition[] {
    const read = (key: string): string[] => (params.get(key) ?? '').split(',').filter(Boolean);

    return [
        ...read(PARAM_BY_KIND.due)
            .filter((value) => DUE_VALUES.has(value))
            .map((value): Condition => ({ kind: 'due', value: value as DueCondition })),
        ...read(PARAM_BY_KIND.field)
            .filter((value) => FIELD_VALUES.has(value))
            .map((value): Condition => ({ kind: 'field', value: value as FieldCondition })),
        ...read(PARAM_BY_KIND.source).map((value): Condition => ({ kind: 'source', value })),
    ];
}

/** Writes the conditions back into a copy of the given params, leaving other keys alone. */
export function writeConditions({
    params,
    conditions,
}: {
    params: URLSearchParams;
    conditions: Condition[];
}): URLSearchParams {
    const next = new URLSearchParams(params);

    for (const key of Object.values(PARAM_BY_KIND)) {
        const values = conditions.filter((condition) => PARAM_BY_KIND[condition.kind] === key);

        if (values.length === 0) next.delete(key);
        else next.set(key, values.map((condition) => condition.value).join(','));
    }

    return next;
}

/** Adds a condition, or removes it if it is already there. */
export function toggleCondition({
    conditions,
    condition,
}: {
    conditions: Condition[];
    condition: Condition;
}): Condition[] {
    const without = conditions.filter((c) => !isSame(c, condition));

    return without.length === conditions.length ? [...conditions, condition] : without;
}

/** True when the condition is currently applied. */
export function hasCondition({
    conditions,
    condition,
}: {
    conditions: Condition[];
    condition: Condition;
}): boolean {
    return conditions.some((c) => isSame(c, condition));
}

/**
 * Conditions of different kinds narrow (a Todoist task that is overdue); conditions of the
 * same kind widen (overdue or due today). Anything else makes two chips of one kind an
 * empty list, which reads as a bug.
 */
export function matchesConditions({
    task,
    conditions,
    now,
}: {
    task: TaskDto;
    conditions: Condition[];
    now: Date;
}): boolean {
    const kinds = new Set(conditions.map((condition) => condition.kind));

    return [...kinds].every((kind) =>
        conditions
            .filter((condition) => condition.kind === kind)
            .some((condition) => matchesOne({ task, condition, now })),
    );
}

/** Applies the conditions to a list, keeping its order. */
export function filterTasks({
    tasks,
    conditions,
    now,
}: {
    tasks: TaskDto[];
    conditions: Condition[];
    now: Date;
}): TaskDto[] {
    if (conditions.length === 0) return tasks;

    return tasks.filter((task) => matchesConditions({ task, conditions, now }));
}

function isSame(a: Condition, b: Condition): boolean {
    return a.kind === b.kind && a.value === b.value;
}

function matchesOne({ task, condition, now }: { task: TaskDto; condition: Condition; now: Date }): boolean {
    if (condition.kind === 'source') return task.source === condition.value;

    if (condition.kind === 'field') {
        if (condition.value === 'noDate') return !task.due?.date;
        if (condition.value === 'noDuration') return !task.duration;

        return task.reminders.length > 0;
    }

    const due = task.due?.date;

    if (!due) return condition.value === 'none';
    if (condition.value === 'none') return false;

    // Days are compared from the start of today, so a task due at 09:00 is not overdue at 17:00.
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = startOfDayFromKey(due);
    const daysAway = Math.round((dueDay.getTime() - startOfToday.getTime()) / 86_400_000);

    if (condition.value === 'overdue') return daysAway < 0;
    if (condition.value === 'today') return daysAway === 0;

    return daysAway >= 0 && daysAway <= 7;
}

function startOfDayFromKey(due: string): Date {
    const [year, month, day] = due.slice(0, 10).split('-').map(Number);

    return new Date(year as number, (month as number) - 1, day as number);
}
