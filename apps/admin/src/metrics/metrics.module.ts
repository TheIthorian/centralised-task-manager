import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
    ConnectorConfig,
    ConnectorConfigSchema,
    Job,
    JobSchema,
    Task,
    TaskSchema,
    User,
    UserSchema,
} from '@ctm/db';
import { MetricsService } from './metrics.service.js';
import { MetricsController } from './metrics.controller.js';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Task.name, schema: TaskSchema },
            { name: ConnectorConfig.name, schema: ConnectorConfigSchema },
            { name: Job.name, schema: JobSchema },
        ]),
    ],
    controllers: [MetricsController],
    providers: [MetricsService],
})
export class MetricsModule {}
