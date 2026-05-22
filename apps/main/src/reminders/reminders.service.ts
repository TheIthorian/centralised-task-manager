import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, type TaskDocument, type RemindEvery } from '../tasks/schemas/task.schema.js';
import { ConnectorConfig, type ConnectorConfigDocument } from '../connectors/schemas/connector-config.schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class RemindersService {
    private readonly logger = new Logger(RemindersService.name);

    constructor(
        @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
        @InjectModel(ConnectorConfig.name) private readonly connectorConfigModel: Model<ConnectorConfigDocument>,
        private readonly notifications: NotificationsService,
    ) {}

    /** Run daily at 09:00. Send reminders, upcoming deadlines, and connector health notifications. */
    @Cron('0 9 * * *')
    async runDailyReminders(): Promise<void> {
        await Promise.all([
            this.sendTaskReminders(),
            this.sendConnectorReconnectAlerts(),
        ]);
    }

    /** Return task IDs that should be surfaced today for a given user. */
    async getSurfacedTaskIds(userId: string): Promise<string[]> {
        const today = new Date();
        const isMonday = today.getDay() === 1;
        const remindEveryValues: RemindEvery[] = isMonday ? ['daily', 'weekly'] : ['daily'];

        const tasks = await this.taskModel
            .find({
                userId: new Types.ObjectId(userId),
                status: 'open',
                'fuzzyDeadline.remindEvery': { $in: remindEveryValues },
            })
            .select('_id');

        return tasks.map((t) => String(t._id));
    }

    private async sendTaskReminders(): Promise<void> {
        const today = new Date();
        const isMonday = today.getDay() === 1;
        const remindEveryValues: RemindEvery[] = isMonday ? ['daily', 'weekly'] : ['daily'];

        const tasks = await this.taskModel
            .find({ status: 'open', 'fuzzyDeadline.remindEvery': { $in: remindEveryValues } })
            .select('userId title fuzzyDeadline');

        this.logger.log(`Reminders: ${tasks.length} tasks surfaced`);

        const byUser = this.groupByUser(tasks);

        for (const [userId, userTasks] of byUser.entries()) {
            const taskList = userTasks.map((t) => `• ${t.title}`).join('\n');

            await this.notifications.send({
                userId,
                type: 'reminder',
                title: `You have ${userTasks.length} task${userTasks.length === 1 ? '' : 's'} due for attention`,
                body: taskList,
            });
        }

        await this.sendUpcomingDeadlines();
    }

    private async sendUpcomingDeadlines(): Promise<void> {
        const tasks = await this.taskModel
            .find({ status: 'open', 'fuzzyDeadline.type': 'this_week' })
            .select('userId title');

        const byUser = this.groupByUser(tasks);

        for (const [userId, userTasks] of byUser.entries()) {
            const taskList = userTasks.map((t) => `• ${t.title}`).join('\n');

            await this.notifications.send({
                userId,
                type: 'upcoming_deadline',
                title: `${userTasks.length} task${userTasks.length === 1 ? '' : 's'} due this week`,
                body: taskList,
            });
        }
    }

    private async sendConnectorReconnectAlerts(): Promise<void> {
        const broken = await this.connectorConfigModel
            .find({ lastError: { $ne: null }, enabled: true })
            .select('userId source');

        this.logger.log(`ConnectorHealth: ${broken.length} connectors need attention`);

        const byUser = this.groupByUser(broken);

        for (const [userId, configs] of byUser.entries()) {
            const sourceList = configs.map((c) => `• ${c.source}`).join('\n');

            await this.notifications.send({
                userId,
                type: 'connector_reconnect',
                title: `${configs.length} connector${configs.length === 1 ? '' : 's'} need reconnecting`,
                body: sourceList,
            });
        }
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
