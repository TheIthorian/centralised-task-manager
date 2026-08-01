import type { ApiHttpClient } from '../../http/api-http-client.js';
import type { DomainClientOptions } from '../../http/http.types.js';
import type { UpdateMeParams, UserDto } from './users.types.js';

/** The current user's profile. */
export class UsersClient {
    private readonly http: ApiHttpClient;

    constructor({ http }: DomainClientOptions) {
        this.http = http;
    }

    /** Get the current user's profile. */
    async getMe(): Promise<UserDto> {
        return this.http.request<UserDto>({ method: 'GET', path: '/users/me' });
    }

    /** Update the current user's profile. */
    async updateMe({ dto }: UpdateMeParams): Promise<UserDto> {
        return this.http.request<UserDto>({ method: 'PATCH', path: '/users/me', body: dto });
    }

    /** Permanently delete the current user's account. */
    async deleteMe(): Promise<void> {
        await this.http.request<void>({ method: 'DELETE', path: '/users/me' });
    }
}
