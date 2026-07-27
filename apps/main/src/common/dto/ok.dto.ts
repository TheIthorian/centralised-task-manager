import type { OkDto as IOkDto } from '@ctm/api-client';

/** Generic ok/success response. */
export class OkDto implements IOkDto {
    ok!: boolean;
}
