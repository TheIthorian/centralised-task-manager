import type { UserDto as IUserDto } from '@ctm/api-client';

/** Authenticated user representation. */
export class UserDto implements IUserDto {
    id!: string;
    email!: string;
    name?: string;
}
