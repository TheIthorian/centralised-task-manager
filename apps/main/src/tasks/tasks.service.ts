import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QuotaExceededError } from '@ctm/errors';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TaskConnectorName, type RemoteTask } from '@ctm/connectors';
import { Task, RELATION_INVERSE, type RelationType, type TaskDocument } from './schemas/task.schema.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { UpdateTaskDto } from './dto/update-task.dto.js';
import type { SetFuzzyDeadlineDto } from './dto/set-fuzzy-deadline.dto.js';
import type { SetTaskStatusDto } from './dto/set-task-status.dto.js';
import type { ListTasksQueryDto } from './dto/list-tasks-query.dto.js';

/** Source name reserved for tasks stored only in CTM (no external connector). */
const LOCAL_SOURCE = 'local';

@Injectable()
export class TasksService {
    constructor(
        @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
        private readonly config: ConfigService,
    ) {}

    /** How many more tasks this user may store before hitting the per-account cap. */
    private async remainingTaskCapacity(userId: string): Promise<number> {
        const max = this.config.getOrThrow<number>('MAX_TASKS_PER_USER');
        const count = await this.taskModel.countDocuments({ userId: new Types.ObjectId(userId) });

        return Math.max(0, max - count);
    }

    /** List tasks for a user with optional filters. */
    async list(userId: string, query: ListTasksQueryDto): Promise<TaskDocument[]> {
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
            .limit(limit);
    }

    /** Get a single task. Throws NotFoundException if not found or wrong user. */
    async findOne({ taskId, userId }: { taskId: string; userId: string }): Promise<TaskDocument> {
        const task = await this.taskModel.findOne({ _id: taskId, userId: new Types.ObjectId(userId) });

        if (!task) throw new NotFoundException('Task not found');

        return task;
    }

    /** Add a typed relation between two of the user's tasks, auto-mirroring the
     *  inverse relation onto the target. Idempotent: re-adding the same pair is a no-op.
     *  Throws BadRequestException for self-relations and NotFoundException for
     *  missing/unowned tasks. */
    async addRelation({
        userId,
        taskId,
        type,
        targetTaskId,
    }: {
        userId: string;
        taskId: string;
        type: RelationType;
        targetTaskId: string;
    }): Promise<TaskDocument> {
        if (taskId === targetTaskId) throw new BadRequestException('A task cannot relate to itself');

        const userObjectId = new Types.ObjectId(userId);

        const [source, target] = await Promise.all([
            this.taskModel.findOne({ _id: taskId, userId: userObjectId }),
            this.taskModel.findOne({ _id: targetTaskId, userId: userObjectId }),
        ]);

        if (!source || !target) throw new NotFoundException('Task not found');

        const inverse = RELATION_INVERSE[type];

        await this.taskModel.updateOne(
            { _id: taskId, userId: userObjectId },
            { $addToSet: { relations: { type, targetTaskId: new Types.ObjectId(targetTaskId) } } },
        );

        await this.taskModel.updateOne(
            { _id: targetTaskId, userId: userObjectId },
            { $addToSet: { relations: { type: inverse, targetTaskId: new Types.ObjectId(taskId) } } },
        );

        return this.taskModel.findById(taskId) as Promise<TaskDocument>;
    }

    /** Remove a typed relation between two tasks, clearing both the relation and its
     *  inverse. No-op if the relation does not exist. */
    async removeRelation({
        userId,
        taskId,
        type,
        targetTaskId,
    }: {
        userId: string;
        taskId: string;
        type: RelationType;
        targetTaskId: string;
    }): Promise<TaskDocument> {
        await this.findOne({ taskId, userId });

        const userObjectId = new Types.ObjectId(userId);
        const inverse = RELATION_INVERSE[type];

        await this.taskModel.updateOne(
            { _id: taskId, userId: userObjectId },
            { $pull: { relations: { type, targetTaskId: new Types.ObjectId(targetTaskId) } } },
        );

        await this.taskModel.updateOne(
            { _id: targetTaskId, userId: userObjectId },
            { $pull: { relations: { type: inverse, targetTaskId: new Types.ObjectId(taskId) } } },
        );

        return this.taskModel.findById(taskId) as Promise<TaskDocument>;
    }

    /** Create a task via write-through: call connector, then persist locally.
     *  When source is 'local', skip the connector and store the task directly in CTM. */
    async create({ userId, dto }: { userId: string; dto: CreateTaskDto }): Promise<TaskDocument> {
        if ((await this.remainingTaskCapacity(userId)) === 0) {
            const max = this.config.getOrThrow<number>('MAX_TASKS_PER_USER');

            throw new QuotaExceededError(`Task limit of ${max} reached. Delete some tasks before creating more.`);
        }

        const { due, deadlineDate } = this.parseDueFields(dto);

        // Outbound sync (CTM → external source) is disabled; all creates are local-only.
        return this.taskModel.create({
            userId: new Types.ObjectId(userId),
            source: dto.source === LOCAL_SOURCE ? LOCAL_SOURCE : dto.source,
            sourceId: new Types.ObjectId().toHexString(),
            title: dto.title,
            description: dto.description,
            status: 'open',
            priority: (dto.priority ?? 3) as 1 | 2 | 3 | 4,
            tags: [],
            locations: dto.locations ?? [],
            due: due ?? null,
            deadlineDate: deadlineDate ?? null,
            duration: dto.duration ?? null,
            syncedAt: new Date(),
        });
    }

    /** Update a task via write-through: call connector, then update locally.
     *  When source is 'local', skip the connector and update directly in CTM. */
    async update({
        taskId,
        userId,
        dto,
    }: {
        taskId: string;
        userId: string;
        dto: UpdateTaskDto;
    }): Promise<TaskDocument> {
        await this.findOne({ taskId, userId });

        const { due, deadlineDate } = this.parseDueFields(dto);

        // Outbound sync (CTM → external source) is disabled; all updates are local-only.
        return this.taskModel.findByIdAndUpdate(
            taskId,
            {
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.priority !== undefined && { priority: dto.priority }),
                ...(due !== undefined && { due }),
                ...(deadlineDate !== undefined && { deadlineDate }),
                ...(dto.duration !== undefined && { duration: dto.duration }),
                ...(dto.tags !== undefined && { tags: dto.tags }),
                ...(dto.locations !== undefined && { locations: dto.locations }),
            },
            { new: true },
        ) as Promise<TaskDocument>;
    }

    /** Set task status to 'open' or 'done' via write-through.
     *  When status is 'done', calls the connector's completeTask for remote sources.
     *  When status is 'open', only the local DB is updated — remote sources (Todoist, Google Tasks)
     *  do NOT support uncomplete; the connector is intentionally not called. Callers should be
     *  aware that uncompleting a remote task produces a local-only change. */
    async setStatus({
        taskId,
        userId,
        dto,
    }: {
        taskId: string;
        userId: string;
        dto: SetTaskStatusDto;
    }): Promise<TaskDocument> {
        await this.findOne({ taskId, userId });

        // Outbound sync (CTM → external source) is disabled; status changes are local-only.

        return this.taskModel.findByIdAndUpdate(taskId, { status: dto.status }, { new: true }) as Promise<TaskDocument>;
    }

    /** Delete a task via write-through.
     *  When source is 'local', skip the connector and delete directly from CTM. */
    async remove({ taskId, userId }: { taskId: string; userId: string }): Promise<void> {
        await this.findOne({ taskId, userId });

        // Outbound sync (CTM → external source) is disabled; deletes are local-only.
        await this.taskModel.deleteOne({ _id: taskId });

        // Clear any relations on other tasks pointing at the deleted task.
        await this.taskModel.updateMany(
            { userId: new Types.ObjectId(userId), 'relations.targetTaskId': new Types.ObjectId(taskId) },
            { $pull: { relations: { targetTaskId: new Types.ObjectId(taskId) } } },
        );
    }

    /** Set the fuzzy deadline on a task (local-only, never written to source). */
    async setFuzzyDeadline({
        taskId,
        userId,
        dto,
    }: {
        taskId: string;
        userId: string;
        dto: SetFuzzyDeadlineDto;
    }): Promise<TaskDocument> {
        await this.findOne({ taskId, userId });

        return this.taskModel.findByIdAndUpdate(
            taskId,
            { fuzzyDeadline: { type: dto.type, remindEvery: dto.remindEvery ?? null } },
            { new: true },
        ) as Promise<TaskDocument>;
    }

    /** Remove the fuzzy deadline from a task. */
    async removeFuzzyDeadline({ taskId, userId }: { taskId: string; userId: string }): Promise<TaskDocument> {
        await this.findOne({ taskId, userId });

        return this.taskModel.findByIdAndUpdate(
            taskId,
            { fuzzyDeadline: null },
            { new: true },
        ) as Promise<TaskDocument>;
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
    }: {
        userId: string;
        source: TaskConnectorName;
        externalAccountId: string;
        remoteTasks: RemoteTask[];
    }): Promise<{ synced: number; skipped: number }> {
        if (remoteTasks.length === 0) return { synced: 0, skipped: 0 };

        const userObjectId = new Types.ObjectId(userId);
        const sourceIds = remoteTasks.map((r) => r.sourceId);

        const existingTasks = await this.taskModel.find({
            userId: userObjectId,
            source,
            externalAccountId,
            sourceId: { $in: sourceIds },
        });

        const existingBySourceId = new Map(existingTasks.map((t) => [t.sourceId, t]));
        const now = new Date();

        let insertBudget = await this.remainingTaskCapacity(userId);
        let synced = 0;
        let skipped = 0;

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
                // syncing, new ones stop at the cap.
                if (insertBudget === 0) {
                    skipped++;
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
            await this.taskModel.bulkWrite(ops, { timestamps: false } as Parameters<
                typeof this.taskModel.bulkWrite
            >[1]);
        }

        return { synced, skipped };
    }

    /** Append a reminder to a task. Returns the new ReminderDto. */
    async addReminder({
        taskId,
        userId,
        dto,
    }: {
        taskId: string;
        userId: string;
        dto: { remindAt: string };
    }): Promise<{ remindAt: string; firedAt: string | null }> {
        const task = await this.taskModel.findOneAndUpdate(
            { _id: taskId, userId: new Types.ObjectId(userId) },
            { $push: { reminders: { remindAt: new Date(dto.remindAt), firedAt: null } } },
            { new: true },
        );

        if (!task) throw new NotFoundException('Task not found');

        const added = task.reminders[task.reminders.length - 1]!;

        return {
            remindAt: added.remindAt.toISOString(),
            firedAt: added.firedAt ? added.firedAt.toISOString() : null,
        };
    }

    /** Remove a reminder from a task by its array index. */
    async removeReminder({ taskId, userId, index }: { taskId: string; userId: string; index: number }): Promise<void> {
        const task = await this.findOne({ taskId, userId });

        if (index < 0 || index >= task.reminders.length) {
            throw new BadRequestException('Reminder index out of range');
        }

        task.reminders.splice(index, 1);

        await this.taskModel.updateOne({ _id: taskId }, { $set: { reminders: task.reminders } });
    }

    private parseDueFields(dto: {
        due?: { date: string; timezone?: string; recurrence?: string };
        deadlineDate?: string;
    }): {
        due: { date: Date; timezone: string | null; recurrence: string | null } | undefined;
        deadlineDate: Date | undefined;
    } {
        return {
            due: dto.due
                ? {
                      date: new Date(dto.due.date),
                      timezone: dto.due.timezone ?? null,
                      recurrence: dto.due.recurrence ?? null,
                  }
                : undefined,
            deadlineDate: dto.deadlineDate ? new Date(dto.deadlineDate) : undefined,
        };
    }
}
