import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConnectorRegistry, type RemoteTask } from '@ctm/connectors';
import { Task, type TaskDocument } from './schemas/task.schema.js';
import { ConnectorsService } from '../connectors/connectors.service.js';
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
        private readonly registry: ConnectorRegistry,
        private readonly connectors: ConnectorsService,
    ) {}

    /** List tasks for a user with optional filters. */
    async list(userId: string, query: ListTasksQueryDto): Promise<TaskDocument[]> {
        const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };

        if (query.status) filter['status'] = query.status;

        if (query.source) filter['source'] = query.source;

        if (query.fuzzy) filter['fuzzyDeadline.type'] = query.fuzzy;

        if (query.surfaced) {
            const today = new Date();
            const isMonday = today.getDay() === 1;
            filter['fuzzyDeadline.remindEvery'] = { $in: isMonday ? ['daily', 'weekly'] : ['daily'] };
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

    /** Create a task via write-through: call connector, then persist locally.
     *  When source is 'local', skip the connector and store the task directly in CTM. */
    async create({ userId, dto }: { userId: string; dto: CreateTaskDto }): Promise<TaskDocument> {
        if (dto.source === LOCAL_SOURCE) {
            return this.taskModel.create({
                userId: new Types.ObjectId(userId),
                source: LOCAL_SOURCE,
                sourceId: new Types.ObjectId().toHexString(),
                title: dto.title,
                description: dto.description,
                status: 'open',
                priority: (dto.priority ?? 3) as 1 | 2 | 3 | 4,
                tags: [],
                locations: dto.locations ?? [],
                sourceDueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
                syncedAt: new Date(),
            });
        }

        const tokens = await this.connectors.getDecryptedTokens({ userId, source: dto.source });
        const connector = this.registry.get(dto.source);
        const remote = await connector.createTask(tokens, {
            title: dto.title,
            description: dto.description,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
            priority: dto.priority,
        });

        return this.taskModel.create({
            userId: new Types.ObjectId(userId),
            source: dto.source,
            sourceId: remote.sourceId,
            title: remote.title,
            description: remote.description,
            status: remote.status,
            priority: remote.priority as 1 | 2 | 3 | 4 | null,
            tags: remote.tags,
            sourceDueDate: remote.dueDate,
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
        const task = await this.findOne({ taskId, userId });

        if (task.source === LOCAL_SOURCE) {
            return this.taskModel.findByIdAndUpdate(
                taskId,
                {
                    ...(dto.title !== undefined && { title: dto.title }),
                    ...(dto.description !== undefined && { description: dto.description }),
                    ...(dto.priority !== undefined && { priority: dto.priority }),
                    ...(dto.dueDate !== undefined && { sourceDueDate: new Date(dto.dueDate) }),
                    ...(dto.tags !== undefined && { tags: dto.tags }),
                    ...(dto.locations !== undefined && { locations: dto.locations }),
                },
                { new: true },
            ) as Promise<TaskDocument>;
        }

        const tokens = await this.connectors.getDecryptedTokens({ userId, source: task.source });
        const connector = this.registry.get(task.source);
        const remote = await connector.updateTask(tokens, task.sourceId, {
            title: dto.title,
            description: dto.description,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
            priority: dto.priority,
        });

        return this.taskModel.findByIdAndUpdate(
            taskId,
            {
                title: remote.title,
                description: remote.description,
                priority: remote.priority,
                sourceDueDate: remote.dueDate,
                tags: dto.tags ?? task.tags,
                locations: dto.locations ?? task.locations,
                syncedAt: new Date(),
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
        const task = await this.findOne({ taskId, userId });

        if (dto.status === 'done' && task.source !== LOCAL_SOURCE) {
            const tokens = await this.connectors.getDecryptedTokens({ userId, source: task.source });
            const connector = this.registry.get(task.source);
            await connector.completeTask(tokens, task.sourceId);
            // Note: there is no uncompleteTask connector method; 'open' is local-only.
        }

        return this.taskModel.findByIdAndUpdate(
            taskId,
            { status: dto.status, syncedAt: new Date() },
            { new: true },
        ) as Promise<TaskDocument>;
    }

    /** Delete a task via write-through.
     *  When source is 'local', skip the connector and delete directly from CTM. */
    async remove({ taskId, userId }: { taskId: string; userId: string }): Promise<void> {
        const task = await this.findOne({ taskId, userId });

        if (task.source !== LOCAL_SOURCE) {
            const tokens = await this.connectors.getDecryptedTokens({ userId, source: task.source });
            const connector = this.registry.get(task.source);
            await connector.deleteTask(tokens, task.sourceId);
        }

        await this.taskModel.deleteOne({ _id: taskId });
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
     *  updatedAt > syncedAt is skipped. Existing tasks are fetched in a single query and
     *  updates are applied via bulkWrite to avoid N+1 DB calls. Uses timestamps: false so
     *  that Mongoose does not bump updatedAt during sync writes, preserving the user-edit signal. */
    async upsertFromRemote({
        userId,
        source,
        remoteTasks,
    }: {
        userId: string;
        source: string;
        remoteTasks: RemoteTask[];
    }): Promise<{ synced: number; skipped: number }> {
        if (remoteTasks.length === 0) return { synced: 0, skipped: 0 };

        const userObjectId = new Types.ObjectId(userId);
        const sourceIds = remoteTasks.map((r) => r.sourceId);

        const existingTasks = await this.taskModel.find({
            userId: userObjectId,
            source,
            sourceId: { $in: sourceIds },
        });

        const existingBySourceId = new Map(existingTasks.map((t) => [t.sourceId, t]));
        const now = new Date();
        let synced = 0;
        let skipped = 0;

        const ops: Parameters<typeof this.taskModel.bulkWrite>[0] = [];

        for (const remote of remoteTasks) {
            const existing = existingBySourceId.get(remote.sourceId);

            if (!existing) {
                ops.push({
                    insertOne: {
                        document: {
                            userId: userObjectId,
                            source,
                            sourceId: remote.sourceId,
                            title: remote.title,
                            description: remote.description ?? null,
                            status: remote.status,
                            priority: (remote.priority ?? null) as 1 | 2 | 3 | 4 | null,
                            tags: remote.tags,
                            sourceDueDate: remote.dueDate ?? null,
                            syncedAt: now,
                        },
                    },
                });

                synced++;
                continue;
            }

            const hasLocalChanges = existing.updatedAt !== undefined && existing.updatedAt > existing.syncedAt;

            if (hasLocalChanges) {
                skipped++;
                continue;
            }

            ops.push({
                updateOne: {
                    filter: { _id: existing._id },
                    update: {
                        $set: {
                            title: remote.title,
                            description: remote.description ?? null,
                            status: remote.status,
                            priority: (remote.priority ?? null) as 1 | 2 | 3 | 4 | null,
                            tags: remote.tags,
                            sourceDueDate: remote.dueDate ?? null,
                            syncedAt: now,
                        },
                    },
                },
            });

            synced++;
        }

        if (ops.length > 0) {
            // timestamps: false prevents Mongoose from bumping updatedAt on sync writes
            await this.taskModel.bulkWrite(ops, { timestamps: false } as Parameters<typeof this.taskModel.bulkWrite>[1]);
        }

        return { synced, skipped };
    }
}
