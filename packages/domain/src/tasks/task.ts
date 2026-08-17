import { ValidationError } from '@ctm/errors';
import type { RelationType } from '@ctm/db';
import type { TaskId } from './ids.js';
import {
    fromRepresentation,
    toRepresentation,
    type Deadline,
    type DueDate,
    type FuzzyDeadline,
} from './deadline.js';
import { inverseOf, type TaskRelation } from './relations.js';

/** Whether a task is outstanding, finished, or filed away. */
export type TaskStatus = 'open' | 'done' | 'archived';

/** A single scheduled reminder and when it was delivered, if it has been. */
export type Reminder = {
    remindAt: Date;
    firedAt: Date | null;
};

/**
 * The slice of a stored task the domain has rules about. Deliberately not the whole document:
 * fields the domain only carries around (title, tags, source) stay out, so `toState()` is a patch
 * narrow enough to hand straight to `doc.set()`.
 */
export type TaskState = {
    status: TaskStatus;
    due: DueDate | null;
    fuzzyDeadline: FuzzyDeadline | null;
    relations: TaskRelation[];
    reminders: Reminder[];
};

/**
 * A task's rules, as an immutable value. Every method returns a new `Task` rather than mutating,
 * so a caller cannot half-apply a change; persistence happens once, at the end, via `toState()`.
 */
export class Task {
    private constructor(private readonly state: Readonly<TaskState>) {}

    /** Build a `Task` from stored fields. Accepts any document carrying them, including a Mongoose one. */
    static fromState(state: Readonly<TaskState>): Task {
        return new Task({
            status: state.status,
            due: state.due,
            fuzzyDeadline: state.fuzzyDeadline,
            relations: [...state.relations],
            reminders: [...state.reminders],
        });
    }

    get status(): TaskStatus {
        return this.state.status;
    }

    /** When this task is due, as a single value rather than the pair of fields it is stored as. */
    get deadline(): Deadline {
        return fromRepresentation({ due: this.state.due, fuzzyDeadline: this.state.fuzzyDeadline });
    }

    get relations(): readonly TaskRelation[] {
        return this.state.relations;
    }

    get reminders(): readonly Reminder[] {
        return this.state.reminders;
    }

    /** Mark the task finished. */
    complete(): Task {
        return this.with({ status: 'done' });
    }

    /** Return a finished task to the open list. */
    reopen(): Task {
        return this.with({ status: 'open' });
    }

    /** Set the status directly, for callers driven by a wire value rather than an intent. */
    withStatus(status: TaskStatus): Task {
        return this.with({ status });
    }

    /** Replace when the task is due. Setting one kind of deadline clears the other. */
    withDeadline(deadline: Deadline): Task {
        return this.with(toRepresentation(deadline));
    }

    /** Add a relation to another task. Re-adding an existing pair is a no-op. */
    addRelation({ type, targetTaskId }: { type: RelationType; targetTaskId: TaskId }): Task {
        if (this.hasRelation({ type, targetTaskId })) return this;

        return this.with({ relations: [...this.state.relations, { type, targetTaskId }] });
    }

    /** Drop a relation to another task. Removing one that is not there is a no-op. */
    removeRelation({ type, targetTaskId }: { type: RelationType; targetTaskId: TaskId }): Task {
        const relations = this.state.relations.filter(
            (relation) => !(relation.type === type && relation.targetTaskId.equals(targetTaskId)),
        );

        return this.with({ relations });
    }

    /** Drop every relation pointing at a task, whatever its type. Used when that task is deleted. */
    removeRelationsTo(targetTaskId: TaskId): Task {
        return this.with({
            relations: this.state.relations.filter((relation) => !relation.targetTaskId.equals(targetTaskId)),
        });
    }

    /** Schedule a reminder. */
    addReminder(remindAt: Date): Task {
        return this.with({ reminders: [...this.state.reminders, { remindAt, firedAt: null }] });
    }

    /** Cancel a reminder by its position. Throws `ValidationError` when the index is out of range. */
    removeReminderAt(index: number): Task {
        if (index < 0 || index >= this.state.reminders.length) {
            throw new ValidationError('Reminder index out of range');
        }

        const reminders = this.state.reminders.filter((_, position) => position !== index);

        return this.with({ reminders });
    }

    /** The stored fields, ready to write back. */
    toState(): TaskState {
        return {
            status: this.state.status,
            due: this.state.due,
            fuzzyDeadline: this.state.fuzzyDeadline,
            relations: [...this.state.relations],
            reminders: [...this.state.reminders],
        };
    }

    private hasRelation({ type, targetTaskId }: { type: RelationType; targetTaskId: TaskId }): boolean {
        return this.state.relations.some(
            (relation) => relation.type === type && relation.targetTaskId.equals(targetTaskId),
        );
    }

    private with(changes: Partial<TaskState>): Task {
        return new Task({ ...this.state, ...changes });
    }
}

/** Both sides of a relation change, so a caller cannot persist one half and forget the other. */
export type RelatedPair = {
    source: Task;
    target: Task;
};

/**
 * Link two tasks, writing the relation on the source and its inverse on the target. The pairing is
 * done here rather than by the caller so the two halves cannot disagree.
 */
export function relate({
    source,
    sourceId,
    target,
    targetId,
    type,
}: {
    source: Task;
    sourceId: TaskId;
    target: Task;
    targetId: TaskId;
    type: RelationType;
}): RelatedPair {
    if (sourceId.equals(targetId)) throw new ValidationError('A task cannot relate to itself');

    return {
        source: source.addRelation({ type, targetTaskId: targetId }),
        target: target.addRelation({ type: inverseOf(type), targetTaskId: sourceId }),
    };
}

/** Unlink two tasks, clearing the relation and its inverse. */
export function unrelate({
    source,
    sourceId,
    target,
    targetId,
    type,
}: {
    source: Task;
    sourceId: TaskId;
    target: Task;
    targetId: TaskId;
    type: RelationType;
}): RelatedPair {
    return {
        source: source.removeRelation({ type, targetTaskId: targetId }),
        target: target.removeRelation({ type: inverseOf(type), targetTaskId: sourceId }),
    };
}
