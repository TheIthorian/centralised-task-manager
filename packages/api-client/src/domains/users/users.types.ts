/** Authenticated user representation. */
export type UserDto = {
    id: string;
    email: string;
    name?: string;
};

/** Partial payload for updating the current user's profile. */
export type UpdateUserDto = {
    email?: string;
    currentPassword?: string;
    newPassword?: string;
};

/** Parameters for {@link UsersClient.updateMe}. */
export type UpdateMeParams = {
    dto: UpdateUserDto;
};
