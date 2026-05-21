import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, type TaskDocument, type RemindEvery } from '../tasks/schemas/task.schema.js';

@Injectable()
export class RemindersService {
    private readonly logger = new Logger(RemindersService.name);

    constructor(@InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>) {}

    /** Run daily at 09:00. Logs tasks that are due for a reminder today. */
    @Cron('0 9 * * *')
    async runDailyReminders(): Promise<void> {
        const today = new Date();
        const isMonday = today.getDay() === 1;
        const remindEveryValues: RemindEvery[] = isMonday ? ['daily', 'weekly'] : ['daily'];

        const tasks = await this.taskModel
            .find({ status: 'open', 'fuzzyDeadline.remindEvery': { $in: remindEveryValues } })
            .select('userId title fuzzyDeadline');

        this.logger.log(`Reminders: ${tasks.length} tasks surfaced`);

        for (const task of tasks) {
            this.logger.log(
                `[reminder] userId=${String(task.userId)} task="${task.title}" deadline=${task.fuzzyDeadline?.type}`,
            );
        }
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
}
