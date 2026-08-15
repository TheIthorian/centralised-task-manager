import type { AdminSessionDto as IAdminSessionDto } from '@ctm/api-client';

export class AdminSessionDto implements IAdminSessionDto {
    username!: string;
    expiresInSeconds!: number;
}
