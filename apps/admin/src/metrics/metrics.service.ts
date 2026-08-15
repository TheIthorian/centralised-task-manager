import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type {
    ConnectorMetricsDto,
    GrowthMetricsDto,
    GrowthPointDto,
    MetricBucketDto,
    SiteMetricsDto,
    SyncMetricsDto,
    TaskMetricsDto,
    UserMetricsDto,
} from '@ctm/api-client';
import {
    ConnectorConfig,
    Job,
    Task,
    User,
    type ConnectorConfigDocument,
    type JobDocument,
    type TaskDocument,
    type UserDocument,
} from '@ctm/db';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One `$group` result: the grouping key, and how many documents fell into it. */
type GroupCount = { _id: string | null; count: number };

/** One `$group` result keyed by calendar day. */
type DayCount = { _id: string; count: number };

@Injectable()
export class MetricsService {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
        @InjectModel(ConnectorConfig.name) private readonly connectorModel: Model<ConnectorConfigDocument>,
        @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    ) {}

    /** Aggregate counts across the whole deployment. */
    async siteMetrics(): Promise<SiteMetricsDto> {
        const now = new Date();

        // Independent aggregations, so they run concurrently rather than serially.
        const [users, tasks, connectors, sync] = await Promise.all([
            this.userMetrics(now),
            this.taskMetrics(),
            this.connectorMetrics(),
            this.syncMetrics(now),
        ]);

        return { users, tasks, connectors, sync, generatedAt: now.toISOString() };
    }

    /** New users and tasks per calendar day, oldest first, including days with no activity. */
    async growthMetrics({ days }: { days: number }): Promise<GrowthMetricsDto> {
        const since = new Date(Date.now() - days * DAY_MS);

        const [userDays, taskDays] = await Promise.all([
            this.countByDay({ model: this.userModel, since }),
            this.countByDay({ model: this.taskModel, since }),
        ]);

        const usersByDate = new Map(userDays.map((day) => [day._id, day.count]));
        const tasksByDate = new Map(taskDays.map((day) => [day._id, day.count]));

        // A day with no rows is absent from the aggregation, but a growth chart needs the zero:
        // without it the gap closes up and the line implies activity that did not happen.
        const points: GrowthPointDto[] = [];

        for (let offset = days - 1; offset >= 0; offset--) {
            const date = isoDate(new Date(Date.now() - offset * DAY_MS));

            points.push({ date, users: usersByDate.get(date) ?? 0, tasks: tasksByDate.get(date) ?? 0 });
        }

        return { points };
    }

    private async userMetrics(now: Date): Promise<UserMetricsDto> {
        const [total, createdLast7Days, createdLast30Days] = await Promise.all([
            this.userModel.countDocuments(),
            this.userModel.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 7 * DAY_MS) } }),
            this.userModel.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 30 * DAY_MS) } }),
        ]);

        return { total, createdLast7Days, createdLast30Days };
    }

    private async taskMetrics(): Promise<TaskMetricsDto> {
        const [total, byStatus, bySource] = await Promise.all([
            this.taskModel.countDocuments(),
            this.groupCount({ model: this.taskModel, field: '$status' }),
            this.groupCount({ model: this.taskModel, field: '$source' }),
        ]);

        return { total, byStatus, bySource };
    }

    private async connectorMetrics(): Promise<ConnectorMetricsDto> {
        const [total, enabled, failing, bySource] = await Promise.all([
            this.connectorModel.countDocuments(),
            this.connectorModel.countDocuments({ enabled: true }),
            this.connectorModel.countDocuments({ lastError: { $ne: null } }),
            this.groupCount({ model: this.connectorModel, field: '$source' }),
        ]);

        return { total, enabled, failing, bySource };
    }

    private async syncMetrics(now: Date): Promise<SyncMetricsDto> {
        const since = new Date(now.getTime() - DAY_MS);

        const [lastSucceeded, succeededLast24Hours, failedLast24Hours, inFlight] = await Promise.all([
            this.jobModel.findOne({ status: 'done' }).sort({ completedAt: -1 }).select('completedAt'),
            this.jobModel.countDocuments({ status: 'done', completedAt: { $gte: since } }),
            this.jobModel.countDocuments({ status: 'failed', updatedAt: { $gte: since } }),
            this.jobModel.countDocuments({ status: { $in: ['queued', 'running'] } }),
        ]);

        return {
            lastSucceededAt: lastSucceeded?.completedAt?.toISOString() ?? null,
            succeededLast24Hours,
            failedLast24Hours,
            inFlight,
        };
    }

    private async groupCount({
        model,
        field,
    }: {
        model: Model<TaskDocument> | Model<ConnectorConfigDocument>;
        field: string;
    }): Promise<MetricBucketDto[]> {
        const groups = await model.aggregate<GroupCount>([
            { $group: { _id: field, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        return groups.map((group) => ({ key: group._id ?? 'unknown', count: group.count }));
    }

    private countByDay({
        model,
        since,
    }: {
        model: Model<UserDocument> | Model<TaskDocument>;
        since: Date;
    }): Promise<DayCount[]> {
        return model.aggregate<DayCount>([
            { $match: { createdAt: { $gte: since } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        ]);
    }
}

function isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}
