import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ValidationError } from '@ctm/errors';
import { appLogger } from '../logging/app-logger.js';
import { Task, type TaskDocument } from '@ctm/db';
import type { ImportResponseDto } from '@ctm/api-client';
import type { ImportEnvelope, ImportTask } from './dto/import-envelope.schema.js';

type OnConflict = 'replace' | 'ignore';

@Injectable()
export class ImportService {
    private readonly logger = appLogger(ImportService.name);

    constructor(@InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>) {}

    /** Apply the tasks in one or more export envelopes to the authenticated user's account. */
    async import({
        userId,
        envelopes,
        onConflict,
    }: {
        userId: string;
        envelopes: ImportEnvelope[];
        onConflict: OnConflict;
    }): Promise<ImportResponseDto> {
        for (const envelope of envelopes) {
            if (envelope.version !== '1') {
                throw new ValidationError(`Unsupported export version: ${envelope.version}`);
            }
        }

        const sorted = [...envelopes].sort((a, b) => a.part - b.part);
        const summary: ImportResponseDto = {
            imported: { tasks: 0 },
            skipped: { tasks: 0 },
        };

        for (const envelope of sorted) {
            for (const task of envelope.tasks) {
                const imported = await this.importTask({ userId, task, onConflict });

                if (imported) summary.imported.tasks++;
                else summary.skipped.tasks++;
            }
        }

        return summary;
    }

    private async importTask({
        userId,
        task,
        onConflict,
    }: {
        userId: string;
        task: ImportTask;
        onConflict: OnConflict;
    }): Promise<boolean> {
        const filter = { userId: new Types.ObjectId(userId), source: task.source, sourceId: task.sourceId };
        const fields = taskDtoToFields(task, userId);

        try {
            if (onConflict === 'ignore') {
                const result = await this.taskModel.updateOne(filter, { $setOnInsert: fields }, { upsert: true });

                return result.upsertedCount > 0;
            }

            await this.taskModel.updateOne(filter, { $set: fields }, { upsert: true });

            return true;
        } catch (err: unknown) {
            if (isDuplicateKeyError(err)) {
                this.logger.debug({ err }, 'Import skipped a row that already exists');

                return false;
            }

            this.logger.error({ err }, 'Import failed to write a row');

            throw err;
        }
    }
}

function isDuplicateKeyError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

function taskDtoToFields(t: ImportTask, userId: string): Record<string, unknown> {
    return {
        userId: new Types.ObjectId(userId),
        source: t.source,
        sourceId: t.sourceId,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority ?? null,
        tags: t.tags,
        due: t.due
            ? { date: new Date(t.due.date), timezone: t.due.timezone ?? null, recurrence: t.due.recurrence ?? null }
            : null,
        deadlineDate: t.deadlineDate ? new Date(t.deadlineDate) : null,
        duration: t.duration ?? null,
        parentId: null,
        fuzzyDeadline: t.fuzzyDeadline ?? null,
        reminders: (t.reminders ?? []).map((r) => ({
            remindAt: new Date(r.remindAt),
            firedAt: r.firedAt ? new Date(r.firedAt) : null,
        })),
        dueDateNotifiedAt: t.dueDateNotifiedAt ? new Date(t.dueDateNotifiedAt) : null,
        locations: t.locations ?? [],
        syncedAt: t.syncedAt ? new Date(t.syncedAt) : new Date(),
    };
}
