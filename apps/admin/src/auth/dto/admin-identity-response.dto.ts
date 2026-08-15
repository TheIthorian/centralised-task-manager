import type { AdminIdentityDto as IAdminIdentityDto } from '@ctm/api-client';

export class AdminIdentityDto implements IAdminIdentityDto {
    email!: string;
    subject!: string;
}
