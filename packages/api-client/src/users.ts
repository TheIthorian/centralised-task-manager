import { getClient } from './client.js';
import type { UserDto, UpdateUserDto } from './types.js';

/** Get the current user's profile. */
export async function getMe(): Promise<UserDto> {
    const { data } = await getClient().get<UserDto>('/users/me');

    return data;
}

/** Update email and/or password. */
export async function updateMe(dto: UpdateUserDto): Promise<UserDto> {
    const { data } = await getClient().patch<UserDto>('/users/me', dto);

    return data;
}

/** Permanently delete the current user's account. */
export async function deleteMe(): Promise<void> {
    await getClient().delete('/users/me');
}
