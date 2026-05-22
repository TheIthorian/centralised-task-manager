// apps/main/src/sync/sync.module.ts
import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module.js';
import { ConnectorsModule } from '../connectors/connectors.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { SyncGateway } from './sync.gateway.js';
import { SyncService } from './sync.service.js';
import { SyncController } from './sync.controller.js';

@Module({
    imports: [JobsModule, ConnectorsModule, TasksModule, AuthModule],
    controllers: [SyncController],
    providers: [SyncGateway, SyncService],
})
export class SyncModule {}
