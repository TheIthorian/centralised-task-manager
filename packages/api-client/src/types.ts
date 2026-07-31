/**
 * Wire-contract re-exports. Each type is defined in the domain that owns it, under
 * `src/domains/<domain>/<domain>.types.ts`.
 */

export { ConnectorType } from './domains/connectors/connectors.types.js';

export type { AppConfigDto, HealthDto } from './domains/app-config/app-config.types.js';
export type {
    AuthorizedAppDto,
    LoginDto,
    OAuthClientInfoDto,
    RefreshDto,
    RegisterDto,
    TokenPair,
} from './domains/auth/auth.types.js';
export type {
    ConnectorAccountDto,
    ConnectorAuthUrlDto,
    ConnectorConfigDto,
    ConnectorDetailsDto,
    ConnectorHealthDto,
    ConnectorStatusDto,
    DiscordStatusDto,
    NotionDatabaseDto,
    UpdateConnectorResponseDto,
} from './domains/connectors/connectors.types.js';
export type {
    ExportEnvelopeDto,
    ExportProfileDto,
    ExportResponseDto,
    ExportTaskDto,
    ImportRequestDto,
    ImportResponseDto,
    ImportSummaryDto,
    StoredFileDto,
} from './domains/data-portability/data-portability.types.js';
export type {
    ChannelPrefsDto,
    MarkAllReadResultDto,
    MarkReadResultDto,
    NotificationData,
    NotificationDto,
    NotificationPreferencesDto,
    NotificationType,
    TestChannelResultDto,
    UpdateChannelPrefsDto,
    UpdateNotificationPreferencesDto,
} from './domains/notifications/notifications.types.js';
export type { OkDto } from './domains/shared.types.js';
export type { TaskSyncJobDto } from './domains/sync/sync.types.js';
export type {
    AddReminderDto,
    CreateTaskDto,
    DueDate,
    Duration,
    FuzzyDeadlineInfo,
    LocationDto,
    RelationType,
    ReminderDto,
    SetFuzzyDeadlineDto,
    SetTaskStatusDto,
    TaskDto,
    TaskFilter,
    TaskRelationDto,
    UpdateTaskDto,
} from './domains/tasks/tasks.types.js';
export type { UpdateUserDto, UserDto } from './domains/users/users.types.js';
