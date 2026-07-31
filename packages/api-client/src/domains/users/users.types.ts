/** Authenticated user representation. */
export type UserDto = {
    id: string;
    email: string;
    name?: string;
    /** IANA identifier the server uses for this user's day boundaries. Defaults to `UTC`. */
    timezone: string;
};

/** Partial payload for updating the current user's profile. */
export type UpdateUserDto = {
    email?: string;
    currentPassword?: string;
    newPassword?: string;
    /** IANA identifier, e.g. `Europe/London`. */
    timezone?: string;
};

/** Parameters for {@link UsersClient.updateMe}. */
export type UpdateMeParams = {
    dto: UpdateUserDto;
};
