import { Injectable } from '@nestjs/common';
import { createLogger } from '@ctm/logger';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { dayOfWeek, instantFromWallClock, toDateKey, UTC, zonedHour } from '@ctm/time';
import { Task, type TaskDocument, type RemindEvery } from '../tasks/schemas/task.schema.js';
import { ConnectorConfig, type ConnectorConfigDocument } from '../connectors/schemas/connector-config.schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { User, type UserDocument } from '../users/schemas/user.schema.js';
import { UsersService } from '../users/users.service.js';

/** The hour, on the reader's own clock, that the daily digest goes out. */
const DAILY_DIGEST_HOUR = 9;

/** The hour an all-day task starts counting as due, on its owner's clock. */
const ALL_DAY_DUE_HOUR = 9;

/** Widest offset from UTC any zone reaches, used to bound the all-day candidate query. */
const MAX_ZONE_OFFSET_MS = 15 * 60 * 60 * 1000;

/** A task selected for a due-date notification. */
type DueTask = Pick<TaskDocument, '_id' | 'userId' | 'title' | 'due'>;

@Injectable()
export class RemindersService {
    private readonly logger = createLogger(RemindersService.name);

    constructor(
        @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
        @InjectModel(ConnectorConfig.name) private readonly connectorConfigModel: Model<ConnectorConfigDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        private readonly notifications: NotificationsService,
        private readonly users: UsersService,
    ) {}

    /**
     * Run hourly. Send reminders, upcoming deadlines, and connector health notifications to the
     * users for whom this hour is 09:00 local, so a daily digest arrives in the morning wherever
     * the reader is rather than in the middle of the server's morning.
     */
    @Cron('0 * * * *')
    async runDailyReminders(): Promise<void> {
        const now = new Date();
        const userIds = await this.userIdsAtLocalHour({ now, hour: DAILY_DIGEST_HOUR });

        if (userIds.length === 0) return;

        this.logger.info({ userCount: userIds.length, localHour: DAILY_DIGEST_HOUR }, 'Sending the daily digest');

        await Promise.all([this.sendTaskReminders({ now, userIds }), this.sendConnectorReconnectAlerts(userIds)]);
    }

    /** Run every 5 minutes. Fire point-in-time reminders and due-date notifications. */
    @Cron('*/5 * * * *')
    async runPointInTimeReminders(): Promise<void> {
        const now = new Date();
        const windowStart = new Date(now.getTime() - 5 * 60 * 1000);

        await Promise.all([
            this.fireManualReminders({ now, windowStart }),
            this.fireDueDateReminders({ now, windowStart }),
        ]);
    }

    private async fireManualReminders({ now, windowStart }: { now: Date; windowStart: Date }): Promise<void> {
        const tasks = await this.taskModel
            .find({
                reminders: {
                    $elemMatch: {
                        remindAt: { $gte: windowStart, $lte: now },
                        firedAt: null,
                    },
                },
            })
            .select('userId title reminders');

        this.logger.info({ taskCount: tasks.length }, 'Checked tasks for due point-in-time reminders');

        for (const task of tasks) {
            for (let i = 0; i < task.reminders.length; i++) {
                const reminder = task.reminders[i]!;

                if (reminder.firedAt !== null) continue;
                if (reminder.remindAt < windowStart || reminder.remindAt > now) continue;

                await this.notifications.send({
                    userId: String(task.userId),
                    type: 'reminder',
                    data: { type: 'reminder', taskId: String(task._id) },
                    title: 'Reminder',
                    body: task.title,
                });

                await this.taskModel.updateOne(
                    { _id: task._id, [`reminders.${i}.firedAt`]: null },
                    { $set: { [`reminders.${i}.firedAt`]: new Date() } },
                );
            }
        }
    }

    private async fireDueDateReminders({ now, windowStart }: { now: Date; windowStart: Date }): Promise<void> {
        const tasks = await this.dueTasksInWindow({ now, windowStart });

        this.logger.info({ taskCount: tasks.length }, 'Checked tasks for due-date reminders');

        for (const task of tasks) {
            await this.notifications.send({
                userId: String(task.userId),
                type: 'reminder',
                data: { type: 'reminder', taskId: String(task._id) },
                title: `${task.title} is due`,
                body: '',
            });

            await this.taskModel.updateOne(
                { _id: task._id, dueDateNotifiedAt: null },
                { $set: { dueDateNotifiedAt: new Date() } },
            );
        }
    }

    /** Return task IDs that should be surfaced today for a given user. */
    async getSurfacedTaskIds(userId: string): Promise<string[]> {
        const timeZone = await this.users.getTimeZone(userId);

        const tasks = await this.taskModel
            .find({
                userId: new Types.ObjectId(userId),
                status: 'open',
                'fuzzyDeadline.remindEvery': { $in: cadencesDueOn({ now: new Date(), timeZone }) },
            })
            .select('_id');

        return tasks.map((t) => String(t._id));
    }

    private async sendTaskReminders({ now, userIds }: { now: Date; userIds: string[] }): Promise<void> {
        // Weekly cadences land on the reader's Monday, which is not the server's Monday for a
        // third of the day, so the cadence set is resolved per zone rather than once per run.
        const byTimeZone = await this.groupUserIdsByTimeZone(userIds);

        for (const [timeZone, zoneUserIds] of byTimeZone.entries()) {
            const tasks = await this.taskModel
                .find({
                    userId: { $in: zoneUserIds.map((id) => new Types.ObjectId(id)) },
                    status: 'open',
                    'fuzzyDeadline.remindEvery': { $in: cadencesDueOn({ now, timeZone }) },
                })
                .select('userId title fuzzyDeadline');

            this.logger.info({ taskCount: tasks.length, timeZone }, 'Checked tasks for fuzzy-deadline reminders');

            const byUser = this.groupByUser(tasks);

            for (const [userId, userTasks] of byUser.entries()) {
                const taskList = userTasks.map((t) => `• ${t.title}`).join('\n');

                await this.notifications.send({
                    userId,
                    type: 'reminder',
                    data: { type: 'reminder' },
                    title: `You have ${userTasks.length} task${userTasks.length === 1 ? '' : 's'} due for attention`,
                    body: taskList,
                });
            }
        }

        await this.sendUpcomingDeadlines(userIds);
    }

    private async sendUpcomingDeadlines(userIds: string[]): Promise<void> {
        const tasks = await this.taskModel
            .find({
                userId: { $in: userIds.map((id) => new Types.ObjectId(id)) },
                status: 'open',
                'fuzzyDeadline.type': 'this_week',
            })
            .select('userId title');

        const byUser = this.groupByUser(tasks);

        for (const [userId, userTasks] of byUser.entries()) {
            const taskList = userTasks.map((t) => `• ${t.title}`).join('\n');

            await this.notifications.send({
                userId,
                type: 'upcoming_deadline',
                data: { type: 'upcoming_deadline' },
                title: `${userTasks.length} task${userTasks.length === 1 ? '' : 's'} due this week`,
                body: taskList,
            });
        }
    }

    private async sendConnectorReconnectAlerts(userIds: string[]): Promise<void> {
        const broken = await this.connectorConfigModel
            .find({
                userId: { $in: userIds.map((id) => new Types.ObjectId(id)) },
                lastError: { $ne: null },
                enabled: true,
            })
            .select('userId source');

        this.logger.info({ brokenConnectorCount: broken.length }, 'Checked connectors for errors');

        const byUser = this.groupByUser(broken);

        for (const [userId, configs] of byUser.entries()) {
            const sourceList = configs.map((c) => `• ${c.source}`).join('\n');

            await this.notifications.send({
                userId,
                type: 'connector_reconnect',
                data: { type: 'connector_reconnect', source: configs[0]?.source },
                title: `${configs.length} connector${configs.length === 1 ? '' : 's'} need reconnecting`,
                body: sourceList,
            });
        }
    }

    /**
     * Tasks whose due moment fell inside the window.
     *
     * Timed tasks are an instant, so a range on `due.date` finds them. An all-day task has no
     * instant: it becomes today's work at 09:00 wherever its owner is, which no single range can
     * express, so the candidates for the days either side are resolved per owner.
     */
    private async dueTasksInWindow({ now, windowStart }: { now: Date; windowStart: Date }): Promise<DueTask[]> {
        const pending = { dueDateNotifiedAt: null, status: { $ne: 'done' } } as const;

        const [timed, allDayCandidates] = await Promise.all([
            this.taskModel
                .find({ ...pending, 'due.allDay': { $ne: true }, 'due.date': { $gte: windowStart, $lte: now } })
                .select('userId title due'),
            this.taskModel
                .find({
                    ...pending,
                    'due.allDay': true,
                    'due.date': {
                        $gte: new Date(windowStart.getTime() - MAX_ZONE_OFFSET_MS),
                        $lte: new Date(now.getTime() + MAX_ZONE_OFFSET_MS),
                    },
                })
                .select('userId title due'),
        ]);

        if (allDayCandidates.length === 0) return timed;

        const zones = await this.timeZonesOf(allDayCandidates.map((task) => String(task.userId)));

        const allDay = allDayCandidates.filter((task) => {
            const timeZone = zones.get(String(task.userId)) ?? UTC;
            const dueAt = instantFromWallClock({
                dateKey: toDateKey({ instant: task.due?.date ?? new Date(), timeZone: UTC }),
                hour: ALL_DAY_DUE_HOUR,
                timeZone,
            });

            return dueAt >= windowStart && dueAt <= now;
        });

        return [...timed, ...allDay];
    }

    /** The users for whom `now` reads as `hour` on their own clock. */
    private async userIdsAtLocalHour({ now, hour }: { now: Date; hour: number }): Promise<string[]> {
        const users = await this.userModel.find().select('timezone');

        return users
            .filter((user) => zonedHour({ instant: now, timeZone: user.timezone ?? UTC }) === hour)
            .map((user) => String(user._id));
    }

    private async groupUserIdsByTimeZone(userIds: string[]): Promise<Map<string, string[]>> {
        const zones = await this.timeZonesOf(userIds);
        const grouped = new Map<string, string[]>();

        for (const userId of userIds) {
            const timeZone = zones.get(userId) ?? UTC;
            const existing = grouped.get(timeZone) ?? [];

            existing.push(userId);
            grouped.set(timeZone, existing);
        }

        return grouped;
    }

    private async timeZonesOf(userIds: string[]): Promise<Map<string, string>> {
        const unique = [...new Set(userIds)];

        const users = await this.userModel
            .find({ _id: { $in: unique.map((id) => new Types.ObjectId(id)) } })
            .select('timezone');

        return new Map(users.map((user) => [String(user._id), user.timezone ?? UTC]));
    }

    private groupByUser<T extends { userId: Types.ObjectId }>(docs: T[]): Map<string, T[]> {
        const map = new Map<string, T[]>();

        for (const doc of docs) {
            const key = String(doc.userId);
            const existing = map.get(key) ?? [];

            existing.push(doc);
            map.set(key, existing);
        }

        return map;
    }
}

/** Which fuzzy-deadline cadences come due on the day `now` falls on in `timeZone`. */
function cadencesDueOn({ now, timeZone }: { now: Date; timeZone: string }): RemindEvery[] {
    const isMonday = dayOfWeek(toDateKey({ instant: now, timeZone })) === 1;

    return isMonday ? ['daily', 'weekly'] : ['daily'];
}
