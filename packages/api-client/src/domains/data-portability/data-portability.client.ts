import type { ApiHttpClient } from '../../http/api-http-client.js';
import type { DomainClientOptions } from '../../http/http.types.js';
import type {
    DownloadExportFileParams,
    ExportResponseDto,
    ImportDataParams,
    ImportResponseDto,
} from './data-portability.types.js';

/** Full-account export and import. */
export class DataPortabilityClient {
    private readonly http: ApiHttpClient;

    constructor({ http }: DomainClientOptions) {
        this.http = http;
    }

    /** Generate a full data export. Returns metadata for the created files. */
    async exportData(): Promise<ExportResponseDto> {
        return this.http.request<ExportResponseDto>({ method: 'POST', path: '/users/me/export' });
    }

    /** Download a single export file as a Blob. */
    async downloadExportFile({ exportId, filename }: DownloadExportFileParams): Promise<Blob> {
        return this.http.request<Blob>({
            method: 'GET',
            path: `/users/me/exports/${exportId}/${filename}`,
            responseType: 'blob',
        });
    }

    /** Import user data from one or more export files. */
    async importData({ files, onConflict }: ImportDataParams): Promise<ImportResponseDto> {
        const form = new FormData();

        for (const file of files) {
            form.append('files', file);
        }

        form.append('onConflict', onConflict);

        return this.http.request<ImportResponseDto>({ method: 'POST', path: '/users/me/import', body: form });
    }
}
