import { NotFoundError, QuotaExceededError, ValidationError } from '@ctm/errors';
import { runInTransaction, type RelationType, type TaskDocument } from '@ctm/db';
import { TaskConnectorName, type RemoteTask } from '@ctm/connectors';
import { Types, type ClientSession, type Model } from 'mongoose';
import { Task, relate, unrelate } from './task.js';
import type { Deadline, DueDate } from './deadline.js';
import { MAX_TASKS_PER_USER } from './limits.js';

/** Source name reserved for tasks stored only in CTM (no external connector). */
const LOCAL_SOURCE = 'local';

/** Outcome of a pull-sync. `droppedOverQuota` counts remote tasks left unimported at the cap. */
export type UpsertFromRemoteResult = {
    synced: number;
    skipped: number;
    droppedOverQuota: number;
};

/** Filters and paging accepted by `list`, matching the API's query string. */
export type ListTasksQuery = {
    filter?: 'today' | 'upcoming' | 'done' | 'all';
    status?: string;
    source?: string;
    fuzzy?: string;
    surfaced?: boolean;
    lastUpdatedFromDate?: string;
    dueBefore?: string;
    dueAfter?: string;
    noDate?: boolean;
    page?: number;
    limit?: number;
};

/** Fields `create` accepts. Dates arrive as ISO strings, matching the wire format. */
export type CreateTaskInput = {
    source: string;
    title: string;
    description?: string | null;
    priority?: 1 | 2 | 3 | 4;
    locations?: { name: string; googleMapsUrl: string }[];
    due?: { date: string; timezone?: string; recurrence?: string };
    deadlineDate?: string;
    duration?: { amount: number; unit: 'minute' | 'day' } | null;
};

/** Fields `update` accepts. Every field is optional; absent means "leave alone". */
export type UpdateTaskInput = {
    title?: string;
    description?: string | null;
    priority?: 1 | 2 | 3 | 4;
    tags?: string[];
    locations?: { name: string; googleMapsUrl: string }[];
    due?: { date: string; timezone?: string; recurrence?: string };
    deadlineDate?: string;
    duration?: { amount: number; unit: 'minute' | 'day' } | null;
};

/** Task reads and writes. Framework-free: construct it with a model and call it from anywhere. */
export class TasksService {
    private readonly taskModel: Model<TaskDocument>;
    private readonly maxTasksPerUser: number;
    private readonly onTransactionsUnavailable: (() => void) | undefined;

    constructor({
        taskModel,
        maxTasksPerUser,
        onTransactionsUnavailable,
    }: {
        taskModel: Model<TaskDocument>;
        maxTasksPerUser?: number;
        onTransactionsUnavailable?: () => void;
    }) {
        this.taskModel = taskModel;
        this.maxTasksPerUser = maxTasksPerUser ?? MAX_TASKS_PER_USER;
        this.onTransactionsUnavailable = onTransactionsUnavailable;
    }

    /** List tasks for a user with optional filters. */
    async list({
        userId,
        query,
        session,
    }: {
        userId: string;
        query: ListTasksQuery;
        session?: ClientSession;
    }): Promise<TaskDocument[]> {
        const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };

        if (query.filter) {
            const todayStart = new Date();

            todayStart.setHours(0, 0, 0, 0);

            const tomorrowStart = new Date(todayStart);

            tomorrowStart.setDate(todayStart.getDate() + 1);

            switch (query.filter) {
                case 'today':
                    filter['status'] = 'open';
                    filter['due.date'] = { $gte: todayStart, $lt: tomorrowStart };
                    break;
                case 'upcoming':
                    filter['status'] = 'open';
                    filter['due.date'] = { $gte: tomorrowStart };
                    break;
                case 'done':
                    filter['status'] = 'done';
                    break;
                case 'all':
                    filter['status'] = { $ne: 'done' };
                    break;
            }
        }

        if (query.status) filter['status'] = query.status;

        if (query.source) filter['source'] = query.source;

        if (query.fuzzy) filter['fuzzyDeadline.type'] = query.fuzzy;

        if (query.surfaced) {
            const today = new Date();
            const isMonday = today.getDay() === 1;
            filter['fuzzyDeadline.remindEvery'] = { $in: isMonday ? ['daily', 'weekly'] : ['daily'] };
        }

        if (query.lastUpdatedFromDate) {
            filter['updatedAt'] = { $gte: new Date(query.lastUpdatedFromDate) };
        }

        if (query.dueBefore) {
            const existing = (filter['due.date'] as Record<string, unknown>) ?? {};

            filter['due.date'] = { ...existing, $lt: new Date(query.dueBefore) };
        }

        if (query.dueAfter) {
            const existing = (filter['due.date'] as Record<string, unknown>) ?? {};

            filter['due.date'] = { ...existing, $gte: new Date(query.dueAfter) };
        }

        if (query.noDate) {
            filter['due'] = null;
            // When noDate is true, date range params are irrelevant — clear any due.date conditions.
            delete filter['due.date'];
        }

        const page = query.page ?? 1;
        const limit = query.limit ?? 50;

        return this.taskModel
            .find(filter)
            .skip((page - 1) * limit)
            .limit(limit)
            .session(session ?? null);
    }

    /** Get a single task. Throws `NotFoundError` if not found or owned by another user. */
    async findOne({
        taskId,
        userId,
        session,
    }: {
        taskId: string;
        userId: string;
        session?: ClientSession;
    }): Promise<TaskDocument> {
        const task = await this.taskModel
            .findOne({ _id: taskId, userId: new Types.ObjectId(userId) })
            .session(session ?? null);

        if (!task) throw new NotFoundError('Task');

        return task;
    }

    /** Create a task. Throws `QuotaExceededError` once the account is at its cap. */
    async create({
        userId,
        input,
        session,
    }: {
        userId: string;
        input: CreateTaskInput;
        session?: ClientSession;
    }): Promise<TaskDocument> {
        if ((await this.remainingTaskCapacity({ userId, session })) === 0) {
            throw new QuotaExceededError(
                `Task limit of ${this.maxTasksPerUser} reached. Delete some tasks before creating more.`,
            );
        }

        const { due, deadlineDate } = parseDueFields(input);

        // Outbound sync (CTM → external source) is disabled; all creates are local-only.
        const [created] = await this.taskModel.create(
            [
                {
                    userId: new Types.ObjectId(userId),
                    source: input.source === LOCAL_SOURCE ? LOCAL_SOURCE : input.source,
                    sourceId: new Types.ObjectId().toHexString(),
                    title: input.title,
                    description: input.description,
                    status: 'open',
                    priority: (input.priority ?? 3) as 1 | 2 | 3 | 4,
                    tags: [],
                    locations: input.locations ?? [],
                    due: due ?? null,
                    deadlineDate: deadlineDate ?? null,
                    duration: input.duration ?? null,
                    syncedAt: new Date(),
                },
            ],
            { session: session ?? undefined },
        );

        return created!;
    }

    /** Update a task's editable fields. Setting a due date clears any fuzzy deadline. */
    async update({
        taskId,
        userId,
        input,
        session,
    }: {
        taskId: string;
        userId: string;
        input: UpdateTaskInput;
        session?: ClientSession;
    }): Promise<TaskDocument> {
        const doc = await this.findOne({ taskId, userId, session });
        const { due, deadlineDate } = parseDueFields(input);

        // Outbound sync (CTM → external source) is disabled; all updates are local-only.
        doc.set({
            ...(input.title !== undefined && { title: input.title }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.priority !== undefined && { priority: input.priority }),
            ...(deadlineDate !== undefined && { deadlineDate }),
            ...(input.duration !== undefined && { duration: input.duration }),
            ...(input.tags !== undefined && { tags: input.tags }),
            ...(input.locations !== undefined && { locations: input.locations }),
        });

        if (due !== undefined) {
            doc.set(Task.fromState(doc).withDeadline({ kind: 'exact', due }).toState());
        }

        await doc.save({ session: session ?? undefined });

        return doc;
    }

    /** Set task status to 'open' or 'done'.
     *  Remote sources (Todoist, Google Tasks) do not support uncomplete, so this is a local-only
     *  change: uncompleting a task that came from a connector will not reopen it at the source. */
    async setStatus({
        taskId,
        userId,
        status,
        session,
    }: {
        taskId: string;
        userId: string;
        status: 'open' | 'done';
        session?: ClientSession;
    }): Promise<TaskDocument> {
        const doc = await this.findOne({ taskId, userId, session });

        // Outbound sync (CTM → external source) is disabled; status changes are local-only.
        doc.set(Task.fromState(doc).withStatus(status).toState());

        await doc.save({ session: session ?? undefined });

        return doc;
    }

    /** Set the fuzzy deadline on a task. Clears any exact due date, which it replaces. */
    async setFuzzyDeadline({
        taskId,
        userId,
        fuzzy,
        session,
    }: {
        taskId: string;
        userId: string;
        fuzzy: { type: 'this_week' | 'this_month' | 'someday'; remindEvery?: 'daily' | 'weekly' | null };
        session?: ClientSession;
    }): Promise<TaskDocument> {
        const deadline: Deadline = {
            kind: 'fuzzy',
            fuzzy: { type: fuzzy.type, remindEvery: fuzzy.remindEvery ?? null },
        };

        return this.applyDeadline({ taskId, userId, deadline, session });
    }

    /** Remove the fuzzy deadline from a task, leaving an exact due date untouched. */
    async removeFuzzyDeadline({
        taskId,
        userId,
        session,
    }: {
        taskId: string;
        userId: string;
        session?: ClientSession;
    }): Promise<TaskDocument> {
        const doc = await this.findOne({ taskId, userId, session });
        const task = Task.fromState(doc);

        if (task.deadline.kind !== 'fuzzy') return doc;

        doc.set(task.withDeadline({ kind: 'none' }).toState());

        await doc.save({ session: session ?? undefined });

        return doc;
    }

    /** Add a typed relation between two of the user's tasks, mirroring the inverse onto the target.
     *  Idempotent: re-adding the same pair is a no-op. Both writes commit together or not at all. */
    async addRelation(args: {
        userId: string;
        taskId: string;
        type: RelationType;
        targetTaskId: string;
    }): Promise<TaskDocument> {
        return this.withSession((session) => this.applyRelationChange({ ...args, session, change: relate }));
    }

    /** Remove a typed relation between two tasks, clearing both the relation and its inverse.
     *  No-op if the relation does not exist. Both writes commit together or not at all. */
    async removeRelation(args: {
        userId: string;
        taskId: string;
        type: RelationType;
        targetTaskId: string;
    }): Promise<TaskDocument> {
        return this.withSession((session) => this.applyRelationChange({ ...args, session, change: unrelate }));
    }

    /** Delete a task and clear every relation pointing at it. Both writes commit together. */
    async remove({ taskId, userId }: { taskId: string; userId: string }): Promise<void> {
        await this.withSession(async (session) => {
            await this.findOne({ taskId, userId, session });

            const taskObjectId = new Types.ObjectId(taskId);

            // Outbound sync (CTM → external source) is disabled; deletes are local-only.
            await this.taskModel.deleteOne({ _id: taskId }, { session });

            await this.taskModel.updateMany(
                { userId: new Types.ObjectId(userId), 'relations.targetTaskId': taskObjectId },
                { $pull: { relations: { targetTaskId: taskObjectId } } },
                { session },
            );
        });
    }

    /** Append a reminder to a task. Returns the reminder that was added. */
    async addReminder({
        taskId,
        userId,
        remindAt,
        session,
    }: {
        taskId: string;
        userId: string;
        remindAt: string;
        session?: ClientSession;
    }): Promise<{ remindAt: string; firedAt: string | null }> {
        // A positional $push rather than a read-modify-write, so two reminders added at once
        // cannot overwrite one another.
        const task = await this.taskModel.findOneAndUpdate(
            { _id: taskId, userId: new Types.ObjectId(userId) },
            { $push: { reminders: { remindAt: new Date(remindAt), firedAt: null } } },
            { new: true, session: session ?? undefined },
        );

        if (!task) throw new NotFoundError('Task');

        const added = task.reminders[task.reminders.length - 1]!;

        return {
            remindAt: added.remindAt.toISOString(),
            firedAt: added.firedAt ? added.firedAt.toISOString() : null,
        };
    }

    /** Remove a reminder from a task by its position. Throws `ValidationError` when out of range. */
    async removeReminder({
        taskId,
        userId,
        index,
        session,
    }: {
        taskId: string;
        userId: string;
        index: number;
        session?: ClientSession;
    }): Promise<void> {
        const doc = await this.findOne({ taskId, userId, session });

        doc.set(Task.fromState(doc).removeReminderAt(index).toState());

        await doc.save({ session: session ?? undefined });
    }

    /** Pull-sync: upsert remote tasks into CTM. CTM-local changes win — any task where
     *  updatedAt > createdAt (i.e. edited in CTM) is skipped. Existing tasks are fetched in a single query and
     *  updates are applied via bulkWrite to avoid N+1 DB calls. Uses timestamps: false so
     *  that Mongoose does not bump updatedAt during sync writes, preserving the user-edit signal. */
    async upsertFromRemote({
        userId,
        source,
        externalAccountId,
        remoteTasks,
        session,
    }: {
        userId: string;
        source: TaskConnectorName;
        externalAccountId: string;
        remoteTasks: RemoteTask[];
        session?: ClientSession;
    }): Promise<UpsertFromRemoteResult> {
        if (remoteTasks.length === 0) return { synced: 0, skipped: 0, droppedOverQuota: 0 };

        const userObjectId = new Types.ObjectId(userId);
        const sourceIds = remoteTasks.map((r) => r.sourceId);

        const existingTasks = await this.taskModel
            .find({
                userId: userObjectId,
                source,
                externalAccountId,
                sourceId: { $in: sourceIds },
            })
            .session(session ?? null);

        const existingBySourceId = new Map(existingTasks.map((t) => [t.sourceId, t]));
        const now = new Date();

        let insertBudget = await this.remainingTaskCapacity({ userId, session });
        let synced = 0;
        let skipped = 0;
        let droppedOverQuota = 0;

        // Pre-generate _ids for root inserts so child tasks can reference them in the same batch
        const newIdBySourceId = new Map<string, Types.ObjectId>();

        for (const remote of remoteTasks) {
            if (!existingBySourceId.has(remote.sourceId)) {
                newIdBySourceId.set(remote.sourceId, new Types.ObjectId());
            }
        }

        const ops: Parameters<typeof this.taskModel.bulkWrite>[0] = [];

        // Process in two passes: roots first, then children — only for inserts
        const roots = remoteTasks.filter((r) => r.parentSourceId === null);
        const children = remoteTasks.filter((r) => r.parentSourceId !== null);

        const buildInsert = (remote: RemoteTask, id: Types.ObjectId): object => {
            const parentSourceId = remote.parentSourceId;
            let parentObjectId: Types.ObjectId | null = null;

            if (parentSourceId) {
                const existingParent = existingBySourceId.get(parentSourceId);

                if (existingParent) {
                    parentObjectId = existingParent._id as Types.ObjectId;
                } else {
                    parentObjectId = newIdBySourceId.get(parentSourceId) ?? null;
                }
            }

            const relations = parentObjectId ? [{ type: 'parent' as RelationType, targetTaskId: parentObjectId }] : [];

            return {
                _id: id,
                userId: userObjectId,
                source,
                externalAccountId,
                sourceId: remote.sourceId,
                title: remote.title,
                description: remote.description ?? null,
                status: remote.status,
                priority: (remote.priority ?? null) as 1 | 2 | 3 | 4 | null,
                tags: remote.tags,
                due: remote.due ?? null,
                deadlineDate: remote.deadline ?? null,
                duration: remote.duration ?? null,
                relations,
                createdAt: now,
                updatedAt: now,
                syncedAt: now,
            };
        };

        const buildUpdate = (remote: RemoteTask): object => ({
            title: remote.title,
            description: remote.description ?? null,
            status: remote.status,
            priority: (remote.priority ?? null) as 1 | 2 | 3 | 4 | null,
            tags: remote.tags,
            due: remote.due ?? null,
            deadlineDate: remote.deadline ?? null,
            duration: remote.duration ?? null,
            syncedAt: now,
        });

        for (const remote of [...roots, ...children]) {
            const existing = existingBySourceId.get(remote.sourceId);

            if (!existing) {
                // A runaway import must not be able to fill the database: existing tasks keep
                // syncing, new ones stop at the cap. Counted separately from `skipped` so the
                // caller can tell the user their account is full rather than silently losing tasks.
                if (insertBudget === 0) {
                    droppedOverQuota++;
                    continue;
                }

                insertBudget--;

                const id = newIdBySourceId.get(remote.sourceId)!;

                ops.push({ insertOne: { document: buildInsert(remote, id) } });
                synced++;
                continue;
            }

            const referenceTime = existing.createdAt ?? existing.syncedAt;
            const hasLocalChanges =
                existing.updatedAt !== undefined && referenceTime !== undefined && existing.updatedAt > referenceTime;

            if (hasLocalChanges) {
                skipped++;
                continue;
            }

            ops.push({
                updateOne: {
                    filter: { _id: existing._id },
                    update: { $set: buildUpdate(remote) },
                },
            });

            synced++;
        }

        if (ops.length > 0) {
            // Cast needed: Mongoose typings don't expose the `timestamps` bulkWrite option
            await this.taskModel.bulkWrite(ops, { timestamps: false, session: session ?? undefined } as Parameters<
                typeof this.taskModel.bulkWrite
            >[1]);
        }

        return { synced, skipped, droppedOverQuota };
    }

    /** Run `fn` in a transaction on this service's own connection. */
    private async withSession<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
        return runInTransaction({ connection: this.taskModel.db, fn, onDegraded: this.onTransactionsUnavailable });
    }

    private async applyRelationChange({
        userId,
        taskId,
        type,
        targetTaskId,
        session,
        change,
    }: {
        userId: string;
        taskId: string;
        type: RelationType;
        targetTaskId: string;
        session: ClientSession;
        change: typeof relate;
    }): Promise<TaskDocument> {
        if (taskId === targetTaskId) throw new ValidationError('A task cannot relate to itself');

        const userObjectId = new Types.ObjectId(userId);

        // Sequential, not Promise.all: a ClientSession carries one transaction number, so two
        // operations running against it at once make the server reject the second.
        const sourceDoc = await this.taskModel.findOne({ _id: taskId, userId: userObjectId }).session(session);
        const targetDoc = await this.taskModel.findOne({ _id: targetTaskId, userId: userObjectId }).session(session);

        if (!sourceDoc || !targetDoc) throw new NotFoundError('Task');

        const sourceId = sourceDoc._id as Types.ObjectId;
        const targetId = targetDoc._id as Types.ObjectId;

        const { source, target } = change({
            source: Task.fromState(sourceDoc),
            sourceId,
            target: Task.fromState(targetDoc),
            targetId,
            type,
        });

        sourceDoc.set(source.toState());
        targetDoc.set(target.toState());

        await sourceDoc.save({ session });
        await targetDoc.save({ session });

        return sourceDoc;
    }

    private async applyDeadline({
        taskId,
        userId,
        deadline,
        session,
    }: {
        taskId: string;
        userId: string;
        deadline: Deadline;
        session?: ClientSession;
    }): Promise<TaskDocument> {
        const doc = await this.findOne({ taskId, userId, session });

        doc.set(Task.fromState(doc).withDeadline(deadline).toState());

        await doc.save({ session: session ?? undefined });

        return doc;
    }

    /** How many more tasks this user may store before hitting the per-account cap. */
    private async remainingTaskCapacity({
        userId,
        session,
    }: {
        userId: string;
        session?: ClientSession;
    }): Promise<number> {
        const count = await this.taskModel
            .countDocuments({ userId: new Types.ObjectId(userId) })
            .session(session ?? null);

        return Math.max(0, this.maxTasksPerUser - count);
    }
}

function parseDueFields(input: {
    due?: { date: string; timezone?: string; recurrence?: string };
    deadlineDate?: string;
}): {
    due: DueDate | undefined;
    deadlineDate: Date | undefined;
} {
    return {
        due: input.due
            ? {
                  date: new Date(input.due.date),
                  timezone: input.due.timezone ?? null,
                  recurrence: input.due.recurrence ?? null,
              }
            : undefined,
        deadlineDate: input.deadlineDate ? new Date(input.deadlineDate) : undefined,
    };
}
