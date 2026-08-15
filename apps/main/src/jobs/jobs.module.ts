import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Job, JobSchema, TASK_SYNC_JOB_MODEL, TaskSyncJobSchema } from '@ctm/db';

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
