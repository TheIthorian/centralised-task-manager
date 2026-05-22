import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Job, JobSchema } from './schemas/job.schema.js';
import { TASK_SYNC_JOB_MODEL, TaskSyncJobSchema } from './schemas/task-sync-job.schema.js';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: Job.name,
                schema: JobSchema,
                discriminators: [{ name: TASK_SYNC_JOB_MODEL, schema: TaskSyncJobSchema }],
            },
        ]),
    ],
    exports: [MongooseModule],
})
export class JobsModule {}
