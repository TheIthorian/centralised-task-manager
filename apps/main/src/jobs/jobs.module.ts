// apps/main/src/jobs/jobs.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Job, JobSchema } from './schemas/job.schema.js';
import { TaskSyncJobSchema } from './schemas/task-sync-job.schema.js';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: Job.name,
                schema: JobSchema,
                discriminators: [{ name: 'task-sync', schema: TaskSyncJobSchema }],
            },
        ]),
    ],
    exports: [MongooseModule],
})
export class JobsModule {}
