import type { UserDto as IUserDto } from '@ctm/api-client';

/** Authenticated user representation. */
export class UserDto implements IUserDto {
    id!: string;
    email!: string;
    name?: string;

    /** IANA identifier the server uses for this user's day boundaries. */
    timezone!: string;
}
