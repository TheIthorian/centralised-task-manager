import type { FuzzyDeadlineType, RemindEvery } from '@ctm/db';

/** An exact, scheduled date for a task, with the timezone and recurrence it was set in. */
export type DueDate = {
    date: Date;
    timezone: string | null;
    recurrence: string | null;
};

/** A coarse "sometime in this window" bucket, used for tasks with no firm date. */
export type FuzzyDeadline = {
    type: FuzzyDeadlineType;
    remindEvery: RemindEvery | null;
};

/**
 * When a task is due. A task has an exact date, a fuzzy bucket, or neither: holding both at once
 * is the ambiguous state this union exists to make unrepresentable.
 */
export type Deadline =
    | { kind: 'exact'; due: DueDate }
    | { kind: 'fuzzy'; fuzzy: FuzzyDeadline }
    | { kind: 'none' };

/** The flat, two-nullable-field shape a `Deadline` is stored as. */
export type DeadlineRepresentation = {
    due: DueDate | null;
    fuzzyDeadline: FuzzyDeadline | null;
};

/** Flatten a `Deadline` into the pair of nullable fields the Task collection stores. */
export function toRepresentation(deadline: Deadline): DeadlineRepresentation {
    switch (deadline.kind) {
        case 'exact':
            return { due: deadline.due, fuzzyDeadline: null };
        case 'fuzzy':
            return { due: null, fuzzyDeadline: deadline.fuzzy };
        case 'none':
            return { due: null, fuzzyDeadline: null };
    }
}

/**
 * Rebuild a `Deadline` from stored fields. Documents written before the two fields became mutually
 * exclusive can carry both; the exact date wins, since it is the more specific of the two.
 */
export function fromRepresentation(representation: DeadlineRepresentation): Deadline {
    if (representation.due) return { kind: 'exact', due: representation.due };

    if (representation.fuzzyDeadline) return { kind: 'fuzzy', fuzzy: representation.fuzzyDeadline };

    return { kind: 'none' };
}
