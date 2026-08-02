import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
    OAuthConnectorRegistry,
    ExternalTaskSourceRegistry,
    TodoistOAuthConnector,
    TodoistTaskSource,
    GoogleTasksOAuthConnector,
    GoogleTasksTaskSource,
    NotionOAuthConnector,
    NotionTaskSource,
    DiscordOAuthConnector,
} from '@ctm/connectors';
import { appLogger } from '../logging/app-logger.js';
import { ConnectorConfig, ConnectorConfigSchema } from './schemas/connector-config.schema.js';
import { ConnectorsService } from './connectors.service.js';
import { ConnectorsController } from './connectors.controller.js';
import { EncryptionService } from './encryption.service.js';
import { ConnectionDetailsValidator } from './connection-details-validator.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: ConnectorConfig.name, schema: ConnectorConfigSchema }]),
        AuthModule,
        UsersModule,
    ],
    controllers: [ConnectorsController],
    providers: [
        ConnectorsService,
        EncryptionService,
        ConnectionDetailsValidator,
        {
            provide: OAuthConnectorRegistry,
            inject: [ConfigService],
            useFactory: (config: ConfigService): OAuthConnectorRegistry => {
                const registry = new OAuthConnectorRegistry();
                const logger = appLogger('connectors');

                registry.register(
                    new TodoistOAuthConnector({
                        clientId: config.getOrThrow<string>('TODOIST_CLIENT_ID'),
                        clientSecret: config.getOrThrow<string>('TODOIST_CLIENT_SECRET'),
                        redirectUri: `${config.getOrThrow<string>('REDIRECT_BASE_URL')}/connectors/oauth/callback/todoist`,
                        logger,
                    }),
                );

                registry.register(
                    new GoogleTasksOAuthConnector({
                        clientId: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
                        clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
                        redirectUri: `${config.getOrThrow<string>('REDIRECT_BASE_URL')}/connectors/oauth/callback/google_tasks`,
                        logger,
                    }),
                );

                registry.register(
                    new NotionOAuthConnector({
                        clientId: config.getOrThrow<string>('NOTION_CLIENT_ID'),
                        clientSecret: config.getOrThrow<string>('NOTION_CLIENT_SECRET'),
                        redirectUri: `${config.getOrThrow<string>('REDIRECT_BASE_URL')}/connectors/oauth/callback/notion`,
                        logger,
                    }),
                );

                registry.register(
                    new DiscordOAuthConnector({
                        clientId: config.getOrThrow<string>('DISCORD_CLIENT_ID'),
                        clientSecret: config.getOrThrow<string>('DISCORD_CLIENT_SECRET'),
                        botToken: config.getOrThrow<string>('DISCORD_BOT_TOKEN'),
                        redirectUri: `${config.getOrThrow<string>('REDIRECT_BASE_URL')}/connectors/oauth/callback/discord`,
                        logger,
                    }),
                );

                return registry;
            },
        },
        {
            provide: ExternalTaskSourceRegistry,
            useFactory: (): ExternalTaskSourceRegistry => {
                const registry = new ExternalTaskSourceRegistry();
                const logger = appLogger('connectors');

                registry.register(new TodoistTaskSource({ logger }));
                registry.register(new GoogleTasksTaskSource({ logger }));
                registry.register(new NotionTaskSource({ logger }));

                return registry;
            },
        },
    ],
    exports: [ConnectorsService, EncryptionService, OAuthConnectorRegistry, ExternalTaskSourceRegistry],
})
export class ConnectorsModule {}
