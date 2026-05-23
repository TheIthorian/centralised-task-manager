import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ConnectorRegistry, TodoistConnector, GoogleTasksConnector, NotionConnector } from '@ctm/connectors';
import { createLogger } from '@ctm/logger';
import { ConnectorConfig, ConnectorConfigSchema } from './schemas/connector-config.schema.js';
import { DiscordConnection, DiscordConnectionSchema } from './schemas/discord-connection.schema.js';
import { ConnectorsService } from './connectors.service.js';
import { ConnectorsController } from './connectors.controller.js';
import { DiscordController } from './discord.controller.js';
import { EncryptionService } from './encryption.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: ConnectorConfig.name, schema: ConnectorConfigSchema },
            { name: DiscordConnection.name, schema: DiscordConnectionSchema },
        ]),
        AuthModule,
        UsersModule,
    ],
    controllers: [ConnectorsController, DiscordController],
    providers: [
        ConnectorsService,
        EncryptionService,
        {
            provide: ConnectorRegistry,
            inject: [ConfigService],
            useFactory: (config: ConfigService): ConnectorRegistry => {
                const registry = new ConnectorRegistry();
                const logger = createLogger('connectors');

                registry.register(
                    new TodoistConnector({
                        clientId: config.getOrThrow<string>('TODOIST_CLIENT_ID'),
                        clientSecret: config.getOrThrow<string>('TODOIST_CLIENT_SECRET'),
                        redirectUri: `${config.getOrThrow<string>('REDIRECT_BASE_URL')}/connectors/oauth/callback/todoist`,
                        logger,
                    }),
                );

                registry.register(
                    new GoogleTasksConnector({
                        clientId: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
                        clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
                        redirectUri: `${config.getOrThrow<string>('REDIRECT_BASE_URL')}/connectors/oauth/callback/google_tasks`,
                        logger,
                    }),
                );

                registry.register(
                    new NotionConnector({
                        clientId: config.getOrThrow<string>('NOTION_CLIENT_ID'),
                        clientSecret: config.getOrThrow<string>('NOTION_CLIENT_SECRET'),
                        redirectUri: `${config.getOrThrow<string>('REDIRECT_BASE_URL')}/connectors/oauth/callback/notion`,
                        logger,
                    }),
                );

                return registry;
            },
        },
    ],
    exports: [ConnectorsService, EncryptionService, ConnectorRegistry],
})
export class ConnectorsModule {}
