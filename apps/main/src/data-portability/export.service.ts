import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import {
    Export,
    type ExportDocument,
    Notification,
    type NotificationDocument,
    type StoredFile,
    Task,
    type TaskDocument,
    User,
    type UserDocument,
} from '@ctm/db';
import { FilesService } from '../files/files.service.js';
import type {
    ExportEnvelopeDto,
    ExportProfileDto,
    ExportResponseDto,
    ExportTaskDto,
    NotificationDto,
} from '@ctm/api-client';

const MAX_PART_BYTES = 50 * 1024 * 1024;
const EFFECTIVE_MAX_BYTES = MAX_PART_BYTES - 4096;

@Injectable()
export class ExportService {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
        @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
        @InjectModel(Export.name) private readonly exportModel: Model<ExportDocument>,
        private readonly files: FilesService,
    ) {}

    /** Export all user data to one or more JSON part files. Returns metadata for each file. */
    async export(userId: string): Promise<ExportResponseDto> {
        const exportId = randomUUID();
        const uid = new Types.ObjectId(userId);

        const [user, tasks, notifications] = await Promise.all([
            this.userModel.findById(uid).orFail(),
            this.taskModel.find({ userId: uid }).lean<Task[]>(),
            this.notificationModel.find({ userId: uid }).lean<Notification[]>(),
        ]);

        const profile: ExportProfileDto = {
            email: user.email,
            name: user.name,
            notificationPreferences: user.notificationPreferences as ExportProfileDto['notificationPreferences'],
        };

        const exportedAt = new Date().toISOString();
        const taskDtos = tasks.map((t) => taskToDto(t as Task & { _id: Types.ObjectId }));
        const notifDtos = notifications.map((n) => notifToDto(n as Notification & { _id: Types.ObjectId }));

        const parts = buildParts({ exportId, exportedAt, profile, tasks: taskDtos, notifications: notifDtos });

        const storedFiles: StoredFile[] = [];

        for (const [i, part] of parts.entries()) {
            const filename = `export-part-${i + 1}.json`;
            const data = Buffer.from(JSON.stringify(part), 'utf-8');
            const stored = await this.files.save({ prefix: exportId, filename, data, contentType: 'application/json' });

            storedFiles.push(stored);
        }

        await this.exportModel.create({ userId: uid, exportId, files: storedFiles });

        return {
            exportId,
            files: storedFiles.map((f) => ({
                filename: f.filename,
                sizeBytes: f.sizeBytes,
                contentType: f.contentType,
                sha256: f.sha256,
            })),
        };
    }
}

function taskToDto(t: Task & { _id: Types.ObjectId }): ExportTaskDto {
    return {
        id: String(t._id),
        source: t.source,
        sourceId: t.sourceId,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority ?? null,
        tags: t.tags ?? [],
        due: t.due ? { date: t.due.date.toISOString(), timezone: t.due.timezone, recurrence: t.due.recurrence } : null,
        deadlineDate: t.deadlineDate ? t.deadlineDate.toISOString() : null,
        duration: t.duration ?? null,
        fuzzyDeadline: t.fuzzyDeadline
            ? { type: t.fuzzyDeadline.type, remindEvery: t.fuzzyDeadline.remindEvery }
            : null,
        reminders: (t.reminders ?? []).map((r) => ({
            remindAt: r.remindAt.toISOString(),
            firedAt: r.firedAt ? r.firedAt.toISOString() : null,
        })),
        dueDateNotifiedAt: t.dueDateNotifiedAt ? t.dueDateNotifiedAt.toISOString() : null,
        locations: t.locations ?? [],
        syncedAt: t.syncedAt.toISOString(),
        createdAt: t.createdAt ? t.createdAt.toISOString() : '',
        updatedAt: t.updatedAt ? t.updatedAt.toISOString() : '',
    };
}

function notifToDto(n: Notification & { _id: Types.ObjectId }): NotificationDto {
    return {
        id: String(n._id),
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        read: n.read,
        createdAt: n.createdAt ? n.createdAt.toISOString() : '',
    };
}

type PartAccumulator = { tasks: ExportTaskDto[]; notifications: NotificationDto[] };

function buildParts({
    exportId,
    exportedAt,
    profile,
    tasks,
    notifications,
}: {
    exportId: string;
    exportedAt: string;
    profile: ExportProfileDto;
    tasks: ExportTaskDto[];
    notifications: NotificationDto[];
}): ExportEnvelopeDto[] {
    type Item = { type: 'task'; data: ExportTaskDto } | { type: 'notification'; data: NotificationDto };
    const items: Item[] = [
        ...tasks.map((d): Item => ({ type: 'task', data: d })),
        ...notifications.map((d): Item => ({ type: 'notification', data: d })),
    ];

    const parts: PartAccumulator[] = [{ tasks: [], notifications: [] }];

    for (const item of items) {
        const current = parts[parts.length - 1];

        if (item.type === 'task') current.tasks.push(item.data);
        else current.notifications.push(item.data);

        if (Buffer.byteLength(JSON.stringify(current), 'utf-8') > EFFECTIVE_MAX_BYTES) {
            if (item.type === 'task') current.tasks.pop();
            else current.notifications.pop();

            const next: PartAccumulator = { tasks: [], notifications: [] };

            if (item.type === 'task') next.tasks.push(item.data);
            else next.notifications.push(item.data);

            parts.push(next);
        }
    }

    const totalParts = parts.length;

    return parts.map(
        (part, i): ExportEnvelopeDto => ({
            version: '1',
            exportedAt,
            exportId,
            part: i + 1,
            totalParts,
            ...(i === 0 ? { profile } : {}),
            tasks: part.tasks,
            notifications: part.notifications,
        }),
    );
}
