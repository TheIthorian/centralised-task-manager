import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type {
    ConnectorMetricsDto,
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

}
