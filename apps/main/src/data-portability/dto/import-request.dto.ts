import type { ImportRequestDto as IImportRequestDto } from '@ctm/api-client';

export class ImportRequestDto implements IImportRequestDto {
    onConflict!: 'replace' | 'ignore';
}
