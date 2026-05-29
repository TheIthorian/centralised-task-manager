import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ValidationError } from '@ctm/errors';
import { User, type UserDocument } from '../users/schemas/user.schema.js';
import { Task, type TaskDocument } from '../tasks/schemas/task.schema.js';
import { Notification, type NotificationDocument } from '../notifications/schemas/notification.schema.js';
import type { ExportEnvelopeDto, ExportProfileDto, ExportTaskDto, ImportResponseDto, NotificationDto } from '@ctm/api-client';

type OnConflict = 'replace' | 'ignore';

@Injectable()
export class ImportService {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
        @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
    ) {}

    /** Apply one or more export envelopes to the authenticated user's account. */
    async import({
        userId,
        envelopes,
        onConflict,
    }: {
        userId: string;
        envelopes: ExportEnvelopeDto[];
        onConflict: OnConflict;
    }): Promise<ImportResponseDto> {
        for (const envelope of envelopes) {
            if (envelope.version !== '1') {
                throw new ValidationError(`Unsupported export version: ${envelope.version}`);
            }
        }

        const sorted = [...envelopes].sort((a, b) => a.part - b.part);
        const summary: ImportResponseDto = {
            imported: { tasks: 0, notifications: 0 },
            skipped: { tasks: 0, notifications: 0 },
        };

        const profileEnvelope = sorted.find((e) => e.profile);

        if (profileEnvelope?.profile) {
            await this.importProfile({ userId, profile: profileEnvelope.profile, onConflict });
        }

        for (const envelope of sorted) {
            for (const task of envelope.tasks) {
                const imported = await this.importTask({ userId, task, onConflict });

                if (imported) summary.imported.tasks++;
                else summary.skipped.tasks++;
            }

            for (const notification of envelope.notifications) {
                const imported = await this.importNotification({ userId, notification, onConflict });

                if (imported) summary.imported.notifications++;
                else summary.skipped.notifications++;
            }
        }

        return summary;
    }

    private async importProfile({
        userId,
        profile,
        onConflict,
    }: {
        userId: string;
        profile: ExportProfileDto;
        onConflict: OnConflict;
    }): Promise<void> {
        if (onConflict === 'ignore') return;

        await this.userModel.updateOne(
            { _id: new Types.ObjectId(userId) },
            { $set: { name: profile.name, notificationPreferences: profile.notificationPreferences } },
        );
    }

    private async importTask({
        userId,
        task,
        onConflict,
    }: {
        userId: string;
        task: ExportTaskDto;
        onConflict: OnConflict;
    }): Promise<boolean> {
        const filter = { userId: new Types.ObjectId(userId), source: task.source, sourceId: task.sourceId };
        const fields = taskDtoToFields(task, userId);

        if (onConflict === 'ignore') {
            const result = await this.taskModel.updateOne(filter, { $setOnInsert: fields }, { upsert: true });

            return result.upsertedCount > 0;
        }

        await this.taskModel.updateOne(filter, { $set: fields }, { upsert: true });

        return true;
    }

    private async importNotification({
        userId,
        notification,
        onConflict,
    }: {
        userId: string;
        notification: NotificationDto;
        onConflict: OnConflict;
    }): Promise<boolean> {
        const filter = { _id: new Types.ObjectId(notification.id), userId: new Types.ObjectId(userId) };
        const fields = {
            userId: new Types.ObjectId(userId),
            type: notification.type,
            title: notification.title,
            body: notification.body,
            data: notification.data,
            read: notification.read,
        };

        if (onConflict === 'ignore') {
            const result = await this.notificationModel.updateOne(filter, { $setOnInsert: fields }, { upsert: true });

            return result.upsertedCount > 0;
        }

        await this.notificationModel.updateOne(filter, { $set: fields }, { upsert: true });

        return true;
    }
}

function taskDtoToFields(t: ExportTaskDto, userId: string): Record<string, unknown> {
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
