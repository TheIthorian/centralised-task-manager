import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OAuthClient, OAuthClientSchema } from '@ctm/db';
import { AuditModule } from '../audit/audit.module.js';
import { OAuthClientsService } from './oauth-clients.service.js';
import { OAuthClientsController } from './oauth-clients.controller.js';

@Module({
    imports: [AuditModule, MongooseModule.forFeature([{ name: OAuthClient.name, schema: OAuthClientSchema }])],
    controllers: [OAuthClientsController],
    providers: [OAuthClientsService],
})
export class ClientsModule {}
