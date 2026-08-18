import type { NotificationDto, NotificationPreferencesDto } from '../notifications/notifications.types.js';
import type { DueDate, Duration, FuzzyDeadlineInfo, LocationDto, ReminderDto } from '../tasks/tasks.types.js';

/** Metadata for a single file persisted to storage (embedded in ExportResponseDto). */
export type StoredFileDto = {
    filename: string;
    sizeBytes: number;
    contentType: string;
    sha256: string;
};

/** Response from POST /users/me/export. */
export type ExportResponseDto = {
    exportId: string;
    files: StoredFileDto[];
};

/** Profile section of an export envelope. */
export type ExportProfileDto = {
    email: string;
    name: string;
    notificationPreferences: NotificationPreferencesDto;
};

/** Task shape used in export envelopes — includes full status (not just `completed`). */
export type ExportTaskDto = {
    id: string;
    source: string;
    sourceId: string;
    title: string;
    description: string | null;
    status: 'open' | 'done' | 'archived';
    priority: 1 | 2 | 3 | 4 | null;
    tags: string[];
    due: DueDate | null;
    deadlineDate: string | null;
    duration: Duration | null;
    fuzzyDeadline: FuzzyDeadlineInfo | null;
    reminders: ReminderDto[];
    dueDateNotifiedAt: string | null;
    locations: LocationDto[];
    syncedAt: string;
    createdAt: string;
    updatedAt: string;
};

/** The JSON envelope written to each export part file. */
export type ExportEnvelopeDto = {
    version: '1';
    exportedAt: string;
    exportId: string;
    part: number;
    totalParts: number;
    /** Only present in part 1. */
    profile?: ExportProfileDto;
    tasks: ExportTaskDto[];
    notifications: NotificationDto[];
};

/** Request body for POST /users/me/import (multipart form field). */
export type ImportRequestDto = {
    onConflict: 'replace' | 'ignore';
};

export type ImportSummaryDto = {
    tasks: number;
};

/** Response from POST /users/me/import. */
export type ImportResponseDto = {
    imported: ImportSummaryDto;
    skipped: ImportSummaryDto;
};

/** Parameters for {@link DataPortabilityClient.downloadExportFile}. */
export type DownloadExportFileParams = {
    exportId: string;
    filename: string;
};

/** Parameters for {@link DataPortabilityClient.importData}. */
export type ImportDataParams = {
    files: Blob[];
    onConflict: 'replace' | 'ignore';
};
