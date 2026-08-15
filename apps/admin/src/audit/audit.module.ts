import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from '@ctm/db';
import { AuditService } from './audit.service.js';
import { AuditController } from './audit.controller.js';

@Module({
    imports: [MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }])],
    controllers: [AuditController],
    providers: [AuditService],
    exports: [AuditService],
})
export class AuditModule {}
