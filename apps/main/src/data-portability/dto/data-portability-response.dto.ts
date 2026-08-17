import type {
    ExportResponseDto as IExportResponseDto,
    ImportResponseDto as IImportResponseDto,
    ImportSummaryDto as IImportSummaryDto,
    StoredFileDto as IStoredFileDto,
} from '@ctm/api-client';

/** Metadata for a single file persisted to storage. */
export class StoredFileDto implements IStoredFileDto {
    filename!: string;
    sizeBytes!: number;
    contentType!: string;
    sha256!: string;
}

/** Response from POST /users/me/export. */
export class ExportResponseDto implements IExportResponseDto {
    exportId!: string;
    files!: StoredFileDto[];
}

/** Per-collection counts for an import run. */
export class ImportSummaryDto implements IImportSummaryDto {
    tasks!: number;
}

/** Response from POST /users/me/import. */
export class ImportResponseDto implements IImportResponseDto {
    imported!: ImportSummaryDto;
    skipped!: ImportSummaryDto;
}
