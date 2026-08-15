/**
 * Request-parameter re-exports. Each `*Params` type is defined next to the domain client
 * that consumes it, under `src/domains/<domain>/<domain>.types.ts`.
 */

export type { ApiClientErrorOptions, ApiClientOptions, AuthTokens, TokenPersistence } from './http/http.types.js';
export { TokenGrant } from './http/http.types.js';
export type {
    GetOAuthClientInfoParams,
    LoginParams,
    RefreshParams,
    RegisterParams,
    RevokeAuthorizedAppParams,
} from './domains/auth/auth.types.js';
export type {
    DisconnectConnectorParams,
    GetConnectorAuthUrlParams,
    ListNotionDatabasesParams,
    SetConnectionDetailsParams,
} from './domains/connectors/connectors.types.js';
export type {
    DownloadExportFileParams,
    ImportDataParams,
} from './domains/data-portability/data-portability.types.js';
export type {
    ListNotificationsParams,
    MarkNotificationReadParams,
    TestNotificationChannelParams,
    UpdateNotificationPreferencesParams,
} from './domains/notifications/notifications.types.js';
export type { CancelSyncJobParams, GetSyncJobParams, SyncConnectorParams } from './domains/sync/sync.types.js';
export type {
    AddReminderParams,
    AddRelationParams,
    CreateTaskParams,
    DeleteTaskParams,
    GetTaskParams,
    ListTasksParams,
    RemoveFuzzyDeadlineParams,
    RemoveRelationParams,
    RemoveReminderParams,
    SetFuzzyDeadlineParams,
    SetTaskStatusParams,
    UpdateTaskParams,
} from './domains/tasks/tasks.types.js';
export type { UpdateMeParams } from './domains/users/users.types.js';
